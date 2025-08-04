import { openai } from "@ai-sdk/openai";
import {
  Agent,
  createTool,
  listMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import {
  action,
  internalAction,
  mutation,
  query,
} from "./_generated/server";
import { betterAuthComponent } from "./auth";
import { EdClient } from "../lib/ed-client";

// Types for course data
type CourseInfo = {
  course: {
    id: number;
    code: string;
    name: string;
    year: string;
    session: string;
    status: string;
    created_at: string;
  };
  last_active: string;
};

// Helper function to get user's courses with ED token
async function getUserCourses(edToken?: string): Promise<CourseInfo[]> {
  if (!edToken) {
    console.log('[getUserCourses] No ED token provided, returning empty courses list');
    return [];
  }

  try {
    const vectorConfig = {
      url: process.env.UPSTASH_VECTOR_REST_URL || '',
      token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
    };
    
    const client = new EdClient(edToken, "eu", vectorConfig);
    const userData = await client.getUserCourses();
    return userData.courses;
  } catch (error) {
    console.error('[getUserCourses] Error fetching courses:', error);
    return [];
  }
}

// Create the course search tool with proper Convex context
const createCourseSearchTool = (edToken?: string) => createTool({
  description: "Search for information within a specific EPFL course's materials, discussions, and Q&A. Use the course code (e.g., 'CS-250', 'MATH-101') for best results.",
  args: z.object({
    courseCode: z.string().describe("The course code (e.g., 'CS-250', 'MATH-101') or partial course name to search in. Course codes are more reliable than full names."),
    query: z.string().describe("The search query to find relevant information in the course materials"),
  }),
  handler: async (ctx, { courseCode, query }) => {
    console.log(`[searchInCourse] Tool called with courseCode: "${courseCode}", query: "${query}"`);
    
    if (!edToken) {
      console.log('[searchInCourse] No ED token provided');
      return {
        success: false,
        message: "ED token not provided. Please ensure you're logged into ED Discussion in settings.",
      };
    }

    try {
      console.log('[searchInCourse] Initializing ED client...');
      const vectorConfig = {
        url: process.env.UPSTASH_VECTOR_REST_URL || '',
        token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
      };
      
      const client = new EdClient(edToken, "eu", vectorConfig);
      
      // Get user's courses to find the matching course ID
      console.log('[searchInCourse] Fetching user courses...');
      const userData = await client.getUserCourses();
      console.log(`[searchInCourse] Found ${userData.courses.length} courses`);
      
      // Search more precisely: exact code match first, then partial matches
      const course = userData.courses.find(c => 
        c.course.code.toLowerCase() === courseCode.toLowerCase() ||
        c.course.code.toLowerCase().includes(courseCode.toLowerCase()) ||
        c.course.name.toLowerCase().includes(courseCode.toLowerCase())
      );
      
      if (!course) {
        console.log(`[searchInCourse] Course "${courseCode}" not found in user's courses`);
        const availableCourses = userData.courses.map(c => `${c.course.code} (${c.course.name})`).join(', ');
        return {
          success: false,
          message: `Course "${courseCode}" not found. Available course codes: ${availableCourses}`,
        };
      }
      
      console.log(`[searchInCourse] Found course: ${course.course.name} (${course.course.code}), searching...`);
      
      // Search in the course
      const searchResults = await client.searchCourse(query, course.course.id, {
        topK: 5,
        includeMetadata: true,
      });
      
      console.log(`[searchInCourse] Search completed, found ${searchResults.length} results`);
      
      const result = {
        success: true,
        courseName: course.course.name,
        courseCode: course.course.code,
        results: searchResults.map(result => ({
          content: result.content || '',
          metadata: result.metadata,
          score: result.score,
        })),
      };
      
      console.log(`[searchInCourse] Returning result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[searchInCourse] Error occurred:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Search failed"
      };
    }
  },
});

// Create agent with dynamic context
function createEPFLAgent(userCourses: CourseInfo[] = [], edToken?: string) {
  // Base instructions
  let instructions = `You are a helpful educational AI assistant for EPFL (École polytechnique fédérale de Lausanne) students.

YOUR ROLE:
- Help EPFL students with their academic questions and studies
- Provide clear, accurate explanations on technical and scientific topics
- Assist with coursework, concepts, and problem-solving
- Support learning across engineering, computer science, mathematics, physics, and other EPFL disciplines
- Search through course materials and discussions when relevant

RESPONSE STYLE:
- Be friendly, encouraging, and supportive
- Provide clear, well-structured explanations
- Use examples when helpful to illustrate concepts
- Break down complex topics into understandable parts
- Encourage critical thinking and learning

WHEN ANSWERING:
1. Always be accurate and scientifically sound
2. If you're unsure about EPFL-specific information, acknowledge this
3. Provide step-by-step explanations for problem-solving
4. Suggest related concepts or topics when relevant
5. Encourage students to think through problems themselves
6. Be patient and adapt explanations to the student's level
7. When appropriate, search course materials for specific information

TOOLS AVAILABLE:
- searchInCourse: Search for information within a specific course's materials and discussions
  * Always use the course CODE (e.g., 'CS-250', 'MATH-101') rather than full course names
  * Course codes are more reliable for finding the correct course

Remember: You're here to support learning, not just provide answers. Help students understand the "why" behind concepts.`;

  // Add course information if available
  if (userCourses.length > 0) {
    instructions += `

STUDENT'S ENROLLED COURSES:
${userCourses.map(c => `- ${c.course.code}: ${c.course.name} (${c.course.year} ${c.course.session})`).join('\n')}

When the student asks about their courses or what courses they have access to, you can reference this list directly. For searching course materials, ALWAYS use the course CODE (the part before the colon) with the searchInCourse tool - for example, use "CS-250" not "Advanced Algorithms".`;
  }

  return new Agent(components.agent, {
    name: "EPFL Educational Assistant",
    chat: openai("gpt-4.1"),
    instructions,
    tools: {
      searchInCourse: createCourseSearchTool(edToken),
    },
  });
}


// Generate a concise title from the first message
function generateThreadTitle(firstMessage: string): string {
  const message = firstMessage.trim();

  if (message.length <= 50) {
    return message;
  }

  const firstSentence = message.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence;
  }

  const words = message.split(' ');
  let title = '';
  for (const word of words) {
    if ((title + word).length > 45) break;
    title += (title ? ' ' : '') + word;
  }

  return `${title}...`;
}

// Create a new chat thread and optionally send first message
export const createChatThread = action({
  args: {
    firstMessage: v.optional(v.string()),
    edToken: v.optional(v.string()),
  },
  handler: async (ctx, { firstMessage, edToken }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    if (!edToken) {
      throw new Error("ED token is required. Please ensure you're logged into ED Discussion in settings.");
    }

    const title = firstMessage?.trim()
      ? generateThreadTitle(firstMessage.trim())
      : "EPFL Assistant Chat";

    // Get user's courses for context
    const userCourses = await getUserCourses(edToken);
    
    // Create agent with dynamic context
    const contextualAgent = createEPFLAgent(userCourses, edToken);
    
    const { threadId } = await contextualAgent.createThread(ctx, {
      userId: userMetadata.id,
      title,
    });

    if (firstMessage?.trim()) {
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId: userMetadata.id,
        prompt: firstMessage.trim(),
      });

      await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
        threadId,
        promptMessageId: messageId,
        edToken,
      });
    }

    return { threadId };
  },
});

// Send a message and trigger agent response
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    edToken: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, prompt, edToken }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    if (!edToken) {
      throw new Error("ED token is required. Please ensure you're logged into ED Discussion in settings.");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId: userMetadata.id,
      prompt,
    });

    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId,
      promptMessageId: messageId,
      edToken,
    });

    return { messageId };
  },
});

// Generate agent response asynchronously
export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    edToken: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, promptMessageId, edToken }) => {
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
    if (!thread) {
      throw new Error("Thread not found");
    }

    if (!edToken) {
      throw new Error("ED token is required for AI messaging. Please ensure you're logged into ED Discussion in settings.");
    }

    // Get user's courses for context
    const userCourses = await getUserCourses(edToken);
    
    if (userCourses.length > 0) {
      console.log(`User has ${userCourses.length} courses available for search`);
    }

    // Create agent with dynamic context
    const contextualAgent = createEPFLAgent(userCourses, edToken);

    // Continue the thread with contextual agent
    const { thread: agentThread } = await contextualAgent.continueThread(ctx, {
      threadId,
    });

    // Generate response with optimized context options
    console.log(`[generateResponseAsync] Starting text generation for thread ${threadId}`);
    const result = await agentThread.streamText(
      {
        promptMessageId,
      },
      {
        contextOptions: {
          excludeToolMessages: false,
          recentMessages: 20,
          searchOptions: {
            limit: 10,
            textSearch: true,
            messageRange: { before: 1, after: 1 },
          },
          searchOtherThreads: false,
        },
        saveStreamDeltas: true,
        storageOptions: {
          saveMessages: "promptAndOutput",
        },
        // maxSteps: 5, // Allow multiple tool calls - removed due to TypeScript error
      },
    );
    
    console.log(`[generateResponseAsync] Text generation completed for thread ${threadId}`);

    await result.consumeStream();
  },
});

// List messages for a thread with streaming support
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, { threadId, paginationOpts, streamArgs }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    const paginated = await listMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    });

    const streams = await syncStreams(ctx, components.agent, {
      threadId,
      streamArgs,
    });

    return { ...paginated, streams };
  },
});

// Get user's chat threads
export const getUserThreads = query({
  args: {},
  handler: async (ctx) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: userMetadata.id,
        paginationOpts: { cursor: null, numItems: 50 },
      },
    );

    return threads;
  },
});

// Delete a thread
export const deleteThread = mutation({
  args: { 
    threadId: v.string(),
    edToken: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, edToken }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    if (!edToken) {
      throw new Error("ED token is required. Please ensure you're logged into ED Discussion in settings.");
    }

    // Get user's courses for context
    const userCourses = await getUserCourses(edToken);
    
    // Create agent with dynamic context
    const contextualAgent = createEPFLAgent(userCourses, edToken);
    
    await contextualAgent.deleteThreadAsync(ctx, { threadId });
    return { success: true };
  },
});

