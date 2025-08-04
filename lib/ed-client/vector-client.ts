import { Index } from '@upstash/vector';
import type {
  VectorClientConfig,
  VectorDocument,
  VectorMetadata,
  SearchResult,
  VectorSyncResult,
  Thread,
  ThreadDetails,
  Comment
} from './types';

export class VectorClient {
  private index: Index;

  constructor(config: VectorClientConfig) {
    this.index = new Index({
      url: config.url,
      token: config.token,
    });
  }

  /**
   * Clean text content by removing HTML and extracting meaningful text
   */
  private cleanText(content: string, document: string): string {
    // Use document field as it's already clean text, fallback to content processing
    if (document?.trim()) {
      return document.trim();
    }

    // Basic HTML stripping if document is empty
    return content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate vector ID for a document
   */
  private generateVectorId(type: 'thread' | 'answer' | 'comment', threadId: number, commentId?: number): string {
    if (type === 'thread') {
      return `thread_${threadId}`;
    }
    return `${type}_${threadId}_${commentId}`;
  }

  /**
   * Create vector documents from thread data
   */
  private createThreadVectorDocuments(thread: Thread | ThreadDetails): VectorDocument[] {
    const documents: VectorDocument[] = [];

    // Thread main content
    const threadContent = this.cleanText(thread.content, thread.document);
    if (threadContent.length > 10) {
      documents.push({
        id: this.generateVectorId('thread', thread.id),
        content: threadContent,
        metadata: {
          course_id: thread.course_id,
          thread_id: thread.id,
          type: 'thread',
          title: thread.title,
          content_preview: threadContent.substring(0, 200),
          created_at: thread.created_at,
          updated_at: thread.updated_at,
          user_id: thread.user_id,
          is_anonymous: thread.is_anonymous,
        },
      });
    }

    // Add answers and comments if this is ThreadDetails
    if ('answers' in thread) {
      const processComments = (comments: Comment[], type: 'answer' | 'comment') => {
        for (const comment of comments) {
          const commentContent = this.cleanText(comment.content, comment.document);
          if (commentContent.length > 10) {
            documents.push({
              id: this.generateVectorId(type, thread.id, comment.id),
              content: commentContent,
              metadata: {
                course_id: thread.course_id,
                thread_id: thread.id,
                comment_id: comment.id,
                type,
                content_preview: commentContent.substring(0, 200),
                created_at: comment.created_at,
                updated_at: comment.updated_at || comment.created_at,
                user_id: comment.user_id,
                is_anonymous: comment.is_anonymous,
              },
            });
          }

          // Process nested comments
          if (comment.comments && comment.comments.length > 0) {
            processComments(comment.comments, 'comment');
          }
        }
      };

      processComments(thread.answers, 'answer');
      processComments(thread.comments, 'comment');
    }

    return documents;
  }

  /**
   * Upsert vectors for a single thread with all its content
   */
  async upsertThread(thread: Thread | ThreadDetails, courseId: number): Promise<void> {
    const documents = this.createThreadVectorDocuments(thread);

    if (documents.length === 0) {
      return;
    }

    const namespace = `course_${courseId}`;
    const vectors = documents.map(doc => ({
      id: doc.id,
      data: doc.content,
      metadata: doc.metadata,
    }));

    await this.index.upsert(vectors, { namespace });
  }

  /**
   * Batch upsert multiple threads for efficiency
   */
  async upsertThreadsBatch(threads: (Thread | ThreadDetails)[], courseId: number): Promise<VectorSyncResult> {
    const namespace = `course_${courseId}`;
    const allDocuments: VectorDocument[] = [];
    const errors: string[] = [];

    // Collect all documents from all threads
    for (const thread of threads) {
      try {
        const documents = this.createThreadVectorDocuments(thread);
        allDocuments.push(...documents);
      } catch (error) {
        errors.push(`Failed to process thread ${thread.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (allDocuments.length === 0) {
      return { upserted: 0, deleted: 0, errors };
    }

    // Batch upsert in chunks to avoid API limits
    const BATCH_SIZE = 100;
    let totalUpserted = 0;

    for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
      const batch = allDocuments.slice(i, i + BATCH_SIZE);
      const vectors = batch.map(doc => ({
        id: doc.id,
        data: doc.content,
        metadata: doc.metadata,
      }));

      try {
        await this.index.upsert(vectors, { namespace });
        totalUpserted += vectors.length;
      } catch (error) {
        errors.push(`Batch upsert failed for chunk ${Math.floor(i / BATCH_SIZE)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { upserted: totalUpserted, deleted: 0, errors };
  }

  /**
   * Delta sync - upsert threads updated since a specific date
   */
  async deltaSyncCourse(
    threads: (Thread | ThreadDetails)[],
    courseId: number,
    sinceDate: Date
  ): Promise<VectorSyncResult> {
    const recentThreads = threads.filter(thread => {
      const updatedAt = new Date(thread.updated_at);
      return updatedAt >= sinceDate;
    });

    return this.upsertThreadsBatch(recentThreads, courseId);
  }

  /**
   * Search for similar content within a course
   */
  async searchCourse(
    query: string,
    courseId: number,
    options: {
      topK?: number;
      includeMetadata?: boolean;
      filter?: string;
    } = {}
  ): Promise<SearchResult[]> {
    const namespace = `course_${courseId}`;
    const { topK = 10, includeMetadata = true, filter } = options;

    const results = await this.index.query({
      data: query,
      topK,
      includeMetadata,
      includeData: true,
      filter,
    }, { namespace });

    return results.map(result => ({
      id: result.id as string,
      score: result.score,
      metadata: result.metadata as unknown as VectorMetadata,
      content: result.data as string,
    }));
  }

  /**
   * Get vectors by their IDs
   */
  async getVectorsByIds(
    ids: string[],
    courseId: number,
    options: {
      includeMetadata?: boolean;
      includeData?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const namespace = `course_${courseId}`;
    const { includeMetadata = true, includeData = true } = options;

    const results = await this.index.fetch(ids, {
      namespace,
      includeMetadata,
      includeData,
    });

    return results
      .filter(result => result !== null)
      .map(result => ({
        id: result.id as string,
        score: 1.0, // Perfect match for direct fetch
        metadata: result.metadata as unknown as VectorMetadata,
        content: result.data as string,
      }));
  }

  /**
   * Delete specific vectors by IDs
   */
  async deleteVectors(ids: string[], courseId: number): Promise<number> {
    const namespace = `course_${courseId}`;
    const result = await this.index.delete(ids, { namespace });
    return result.deleted;
  }

  /**
   * Delete a specific thread and all its related vectors
   */
  async deleteThread(threadId: number, courseId: number): Promise<number> {
    const namespace = `course_${courseId}`;

    // Delete by prefix to catch all related vectors (thread, answers, comments)
    const result = await this.index.delete({
      prefix: `thread_${threadId}`,
    }, { namespace });

    // Also delete any answer/comment vectors for this thread
    const answerResult = await this.index.delete({
      prefix: `answer_${threadId}_`,
    }, { namespace });

    const commentResult = await this.index.delete({
      prefix: `comment_${threadId}_`,
    }, { namespace });

    return result.deleted + answerResult.deleted + commentResult.deleted;
  }

  /**
   * Delete entire course namespace and all its vectors
   */
  async deleteCourse(courseId: number): Promise<void> {
    const namespace = `course_${courseId}`;
    await this.index.reset({ namespace });
  }

  /**
   * Get course statistics
   */
  async getCourseStats(courseId: number): Promise<{
    totalVectors: number;
    threadVectors: number;
    answerVectors: number;
    commentVectors: number;
  }> {
    const namespace = `course_${courseId}`;

    const stats = {
      totalVectors: 0,
      threadVectors: 0,
      answerVectors: 0,
      commentVectors: 0,
    };

    try {
      // Use range query with pagination to handle large datasets
      let cursor = '';
      let hasMore = true;
      const limit = 1000; // Upstash limit

      while (hasMore) {
        const batch = await this.index.range({
          cursor,
          limit,
        }, { namespace });

        // Process this batch
        for (const vector of batch.vectors) {
          stats.totalVectors++;

          if (vector.id.startsWith('thread_')) {
            stats.threadVectors++;
          } else if (vector.id.startsWith('answer_')) {
            stats.answerVectors++;
          } else if (vector.id.startsWith('comment_')) {
            stats.commentVectors++;
          }
        }

        // Check if there are more vectors
        hasMore = batch.vectors.length === limit && !!batch.nextCursor;
        cursor = batch.nextCursor || '';
      }
    } catch (error) {
      // If range fails, return basic stats with error info
      console.warn('Failed to get detailed stats, returning basic counts');
      return {
        totalVectors: 0,
        threadVectors: 0,
        answerVectors: 0,
        commentVectors: 0,
      };
    }

    return stats;
  }

}