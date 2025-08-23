import { openai } from "@ai-sdk/openai";
import {
  Agent,
  createTool,
  listMessages as listAgentMessages,
  saveMessage,
  saveMessages,
  stepCountIs,
  syncStreams,
  vStreamArgs,
  MessageDoc,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { EdClient, ParsedUserData } from "../lib/ed-client";
import { components, internal, api } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

const EdAgent = new Agent(components.agent, {
  name: "Educational Assistant",
  languageModel: openai("gpt-4.1-mini"),
  instructions: `You are a helpful educational AI assistant for EPFL (École polytechnique fédérale de Lausanne) students.

YOUR ROLE:
- Help EPFL students with their academic questions and studies
- Provide clear, accurate explanations on technical and scientific topics
- Assist with coursework, concepts, and problem-solving
- Support learning across engineering, computer science, mathematics, physics, and other EPFL disciplines
- Search through course materials and discussions when relevant

RESPONSE STYLE:
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
  * You must pass the edToken parameter when using this tool

Remember: You're here to support learning, not just provide answers. Help students understand the "why" behind concepts.`,
  stopWhen: stepCountIs(3),
});

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

  const words = message.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + word).length > 45) break;
    title += (title ? " " : "") + word;
  }

  return `${title}...`;
}

// Helper function to authorize user access
async function authorizeUser(ctx: any) {
  const userMetadata = await betterAuthComponent.getAuthUser(ctx);
  if (!userMetadata || !userMetadata.userId) {
    throw new Error("Unauthorized");
  }
  return userMetadata.userId;
}

// Create a new chat thread
export const createChatThread = mutation({
  args: {
    firstMessage: v.optional(v.string()),
    edToken: v.string(),
  },
  handler: async (ctx, { firstMessage, edToken }) => {
    const userId = await authorizeUser(ctx);

    const title = firstMessage?.trim()
      ? generateThreadTitle(firstMessage.trim())
      : "EPFL Assistant Chat";

    const { threadId } = await EdAgent.createThread(ctx, {
      userId,
      title,
    });

    if (firstMessage?.trim()) {
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        prompt: firstMessage.trim(),
      });

      await ctx.scheduler.runAfter(0, internal.chat.streamAsync, {
        threadId,
        promptMessageId: messageId,
        edToken,
      });
    }

    return { threadId };
  },
});

// Helper function to create courses context prompt
const coursesContext = (user: ParsedUserData) => {
  
  if (user.courses.length === 0) return "";
  
  return `# STUDENT'S ENROLLED COURSES:\n${user.courses.map((c) => `- ${c.course.code}: ${c.course.name} (${c.course.year} ${c.course.session})`).join("\n")}\n\nWhen the student asks about their courses or what courses they have access to, you can reference this list directly. For searching course materials, ALWAYS use the course CODE (the part before the colon) with the searchInCourse tool - for example, use "CS-250" not "Advanced Algorithms".`;
};

/**
 * RECOMMENDED PATTERN: Generate the prompt message first, then asynchronously generate the stream response.
 * This enables optimistic updates on the client.
 */
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    edToken: v.string(),
  },
  handler: async (ctx, { threadId, prompt, edToken }) => {
    const userId = await authorizeUser(ctx);

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      prompt,
    });

    await ctx.scheduler.runAfter(0, internal.chat.streamAsync, {
      threadId,
      promptMessageId: messageId,
      edToken,
    });

    return { messageId };
  },
});

// Generate agent response asynchronously
export const streamAsync = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    edToken: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, edToken }) => {
    const vectorConfig = {
      url: process.env.UPSTASH_VECTOR_REST_URL || "",
      token: process.env.UPSTASH_VECTOR_REST_TOKEN || "",
    };
    const client = new EdClient(edToken, "eu", vectorConfig);

    // Get user's course context
    const userCourses = (await client.getUserCourses());
    const contextPrompt = coursesContext(userCourses);

    console.log(
      `[streamAsync] Starting text generation for thread ${threadId}`,
    );



    const result = await EdAgent.streamText(
      ctx,
      { threadId },
      {
        promptMessageId: promptMessageId,
        system: contextPrompt,
        
        tools: {
          searchInCourse: createTool({
            description:
              "Search for information within a specific EPFL course's materials, discussions, and Q&A. Use the course code (e.g., 'CS-250', 'MATH-101') for best results.",
            args: z.object({
              courseCode: z
                .string()
                .describe(
                  "The course code (e.g., 'CS-250', 'MATH-101') or partial course name to search in. Course codes are more reliable than full names.",
                ),
              query: z
                .string()
                .describe(
                  "The search query to find relevant information in the course materials",
                ),
            }),
            handler: async (ctx, args) => {
              const { courseCode, query } = args as {
                courseCode: string;
                query: string;
              };
              console.log(
                `[searchInCourse] Tool called with courseCode: "${courseCode}", query: "${query}"`,
              );

              try {
                console.log("[searchInCourse] Initializing ED client...");

                const vectorConfig = {
                  url: process.env.UPSTASH_VECTOR_REST_URL || "",
                  token: process.env.UPSTASH_VECTOR_REST_TOKEN || "",
                };
                const client = new EdClient(edToken, "eu", vectorConfig);

                // Get user's courses to find the matching course ID
                console.log("[searchInCourse] Fetching user courses...");
                const userData = await client.getUserCourses();
                console.log(
                  `[searchInCourse] Found ${userData.courses.length} courses`,
                );

                // Search more precisely: exact code match first, then partial matches
                const course = userData.courses.find(
                  (c) =>
                    c.course.code.toLowerCase() === courseCode.toLowerCase() ||
                    c.course.code
                      .toLowerCase()
                      .includes(courseCode.toLowerCase()) ||
                    c.course.name
                      .toLowerCase()
                      .includes(courseCode.toLowerCase()),
                );

                if (!course) {
                  console.log(
                    `[searchInCourse] Course "${courseCode}" not found in user's courses`,
                  );
                  const availableCourses = userData.courses
                    .map((c) => `${c.course.code} (${c.course.name})`)
                    .join(", ");
                  return {
                    success: false,
                    message: `Course "${courseCode}" not found. Available course codes: ${availableCourses}`,
                  };
                }

                console.log(
                  `[searchInCourse] Found course: ${course.course.name} (${course.course.code}), searching...`,
                );

                // Search in the course
                const searchResults = await client.searchCourse(
                  query,
                  course.course.id,
                  {
                    topK: 5,
                    includeMetadata: true,
                  },
                );

                console.log(
                  `[searchInCourse] Search completed, found ${searchResults.length} results`,
                );

                const result = {
                  success: true,
                  courseName: course.course.name,
                  courseCode: course.course.code,
                  results: searchResults.map((result) => ({
                    content: result.content || "",
                    metadata: result.metadata,
                    score: result.score,
                  })),
                };

                console.log(
                  `[searchInCourse] Returning result:`,
                  JSON.stringify(result, null, 2),
                );
                return result;
              } catch (error) {
                console.error("[searchInCourse] Error occurred:", error);
                return {
                  success: false,
                  message:
                    error instanceof Error ? error.message : "Search failed",
                };
              }
            },
          }),
        },
      },
      { 
        saveStreamDeltas: true,
      },
    );

    // We need to make sure the stream finishes - by awaiting each chunk
    // or using this call to consume it all.
    await result.consumeStream();
  },
});


/**
 * Query & subscribe to messages & threads
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator, // Used to paginate the messages.
    streamArgs: vStreamArgs, // Used to stream messages.
  },
  handler: async (ctx, { threadId, paginationOpts, streamArgs }) => {
    await authorizeUser(ctx);

    const streams = await syncStreams(ctx, components.agent, {
      threadId,
      streamArgs,
      includeStatuses: ["aborted", "streaming"],
    });
    // Here you could filter out / modify the stream of deltas / filter out
    // deltas.

    const paginated = await listAgentMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    });
    return {
      ...paginated,
      streams,
    };
  },
});

// Get user's chat threads
export const getUserThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await authorizeUser(ctx);

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
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
  },
  handler: async (ctx, { threadId }) => {
    await authorizeUser(ctx);

    await EdAgent.deleteThreadAsync(ctx, { threadId });
    return { success: true };
  },
});
