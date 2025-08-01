import { openai } from "@ai-sdk/openai";
import {
  Agent,
  listMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  action,
  internalAction,
  mutation,
  query,
} from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Create agent instance with proper configuration
const agent = new Agent(components.agent, {
  name: "EPFL Educational Assistant",
  chat: openai("gpt-4o-mini"),
  instructions: `You are a helpful educational AI assistant for EPFL (École polytechnique fédérale de Lausanne) students.

YOUR ROLE:
- Help EPFL students with their academic questions and studies
- Provide clear, accurate explanations on technical and scientific topics
- Assist with coursework, concepts, and problem-solving
- Support learning across engineering, computer science, mathematics, physics, and other EPFL disciplines

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

Remember: You're here to support learning, not just provide answers. Help students understand the "why" behind concepts.`,
});

// Generate a concise title from the first message
function generateThreadTitle(firstMessage: string): string {
  const message = firstMessage.trim();
  
  // If message is short enough, use it as title
  if (message.length <= 50) {
    return message;
  }
  
  // Extract first sentence or truncate at word boundary
  const firstSentence = message.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence;
  }
  
  // Truncate at word boundary around 45 characters
  const words = message.split(' ');
  let title = '';
  for (const word of words) {
    if ((title + word).length > 45) break;
    title += (title ? ' ' : '') + word;
  }
  
  return title + '...';
}

// Create a new chat thread and optionally send first message
export const createChatThread = action({
  args: { 
    firstMessage: v.optional(v.string())
  },
  handler: async (ctx, { firstMessage }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    // Generate title from first message or use default
    const title = firstMessage?.trim() 
      ? generateThreadTitle(firstMessage.trim())
      : "EPFL Assistant Chat";

    const { threadId } = await agent.createThread(ctx, {
      userId: userMetadata.id,
      title,
      summary: "Educational chat with EPFL assistant",
    });

    // If we have a first message, send it immediately
    if (firstMessage?.trim()) {
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId: userMetadata.id,
        prompt: firstMessage.trim(),
      });

      // Schedule async response generation
      await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
        threadId,
        promptMessageId: messageId,
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
  },
  handler: async (ctx, { threadId, prompt }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId: userMetadata.id,
      prompt,
    });

    // Schedule async response generation
    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId,
      promptMessageId: messageId,
    });

    return { messageId };
  },
});

// Generate agent response asynchronously
export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId }) => {
    // Continue the thread
    const { thread } = await agent.continueThread(ctx, { threadId });

    // Generate response with optimized context options
    const result = await thread.streamText(
      {
        promptMessageId,
      },
      {
        contextOptions: {
          excludeToolMessages: true,
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
      },
    );

    // Consume the stream to ensure it's fully processed
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

    // Get threads from the agent component
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
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      throw new Error("Unauthorized");
    }

    // Delete using the agent component
    await agent.deleteThreadAsync(ctx, { threadId });

    return { success: true };
  },
});
