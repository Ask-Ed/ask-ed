import fetch from 'node-fetch';
import type { Comment, EdApiResponse, ParsedUserData, SearchResult, ThreadDetails, ThreadQueryOptions, ThreadsResponse, VectorClientConfig, VectorSyncResult } from './types';
import { VectorClient } from './vector-client';

export class EdClient {
  private baseUrl: string;
  private token: string;
  private vectorClient?: VectorClient;

  constructor(
    token: string,
    region: 'eu' | 'us' = 'eu',
    vectorConfig?: VectorClientConfig
  ) {
    this.token = token;
    this.baseUrl = `https://${region}.edstem.org/api`;

    if (vectorConfig) {
      this.vectorClient = new VectorClient(vectorConfig);
    }
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'dnt': '1',
          'origin': 'https://edstem.org',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          'x-token': this.token
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ed API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch from Ed API: ${error.message}`);
      }
      throw new Error('Unknown error occurred while fetching from Ed API');
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 5, context?: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxRetries) break;

        const isRateLimit = lastError.message.includes('429') || lastError.message.includes('rate');
        const isTimeout = lastError.message.includes('timeout') || lastError.message.includes('ETIMEDOUT');
        
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        let waitTime = 100 * Math.pow(2, attempt - 1);
        
        // Rate limits need longer waits
        if (isRateLimit) {
          waitTime = Math.max(waitTime, 2000);
        }
        
        // Timeouts can retry immediately first time, then backoff
        if (isTimeout && attempt === 1) {
          waitTime = 0;
        }

        if (context && waitTime > 0) {
          console.log(`${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`);
        }

        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  async getUserCourses(): Promise<ParsedUserData> {
    const data = await this.makeRequest<EdApiResponse>('/user');

    if (!data.user || !data.courses) {
      throw new Error('Invalid API response: missing user or courses data');
    }

    if (!data.user.id || !data.user.name || !data.user.email) {
      throw new Error('Invalid API response: incomplete user data');
    }

    const currentYear = new Date().getFullYear().toString();

    return {
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email
      },
      courses: data.courses
        .filter(courseData => courseData?.course && courseData.course.year === currentYear)
        .map(courseData => ({
          course: {
            id: courseData.course.id,
            code: courseData.course.code,
            name: courseData.course.name,
            year: courseData.course.year,
            session: courseData.course.session,
            status: courseData.course.status,
            created_at: courseData.course.created_at
          },
          last_active: courseData.last_active
        }))
    };
  }

  private buildQueryString(params: Record<string, string | number | undefined>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async getCourseThreads(courseId: number, options: ThreadQueryOptions = {}): Promise<ThreadsResponse> {
    const { limit = 30, sort = 'new', sort_key, offset } = options;

    const queryParams = this.buildQueryString({
      limit,
      sort,
      sort_key,
      offset
    });

    const data = await this.makeRequest<ThreadsResponse>(`/courses/${courseId}/threads${queryParams}`);
    return data;
  }

  async getCourseThreadsSince(courseId: number, sinceDate: Date, options: Omit<ThreadQueryOptions, 'sort'> = {}): Promise<ThreadsResponse> {
    const { limit = 30, offset } = options;

    const queryParams = this.buildQueryString({
      limit,
      sort: 'new',
      offset,
      since: sinceDate.toISOString()
    });

    const data = await this.makeRequest<ThreadsResponse>(`/courses/${courseId}/threads${queryParams}`);

    // Filter threads to ensure they match the since date (double-check API response)
    const filteredThreads = data.threads.filter(thread => {
      const threadDate = new Date(thread.updated_at);
      return threadDate >= sinceDate;
    });

    return {
      ...data,
      threads: filteredThreads
    };
  }

  async getAllCourseThreads(courseId: number, sinceDate?: Date): Promise<ThreadsResponse> {
    const allThreads: ThreadsResponse['threads'] = [];
    const allUsers: ThreadsResponse['users'] = [];
    const limit = 100; // Ed API caps at 100 threads per request
    let offset = 0;
    let totalFetched = 0;
    let pageCount = 0;

    console.log(`Starting to fetch threads for course ${courseId} with limit=${limit}${sinceDate ? ` since ${sinceDate.toISOString()}` : ''}`);

    while (true) {
      pageCount++;
      const options: ThreadQueryOptions = {
        limit,
        sort: 'new',
        offset
      };

      const response = sinceDate
        ? await this.getCourseThreadsSince(courseId, sinceDate, options)
        : await this.getCourseThreads(courseId, options);

      // Break if no threads returned
      if (response.threads.length === 0) {
        console.log(`No more threads returned, stopping pagination at page ${pageCount}`);
        break;
      }

      allThreads.push(...response.threads);
      totalFetched += response.threads.length;

      // Collect unique users
      for (const user of response.users) {
        if (!allUsers.find(u => u.id === user.id)) {
          allUsers.push(user);
        }
      }

      // Move to next page using offset
      offset += response.threads.length;

      // Break if we got fewer threads than the API's known maximum (indicates last page)
      if (response.threads.length < 100) {
        console.log(`Got ${response.threads.length} threads (less than API max 100), this was the last page`);
        break;
      }

      // Progress logging every 10 pages (1000 threads)
      if (pageCount % 10 === 0) {
        console.log(`Fetched ${totalFetched} threads so far for course ${courseId} (page ${pageCount})`);
      }
    }

    console.log(`Total threads fetched for course ${courseId}: ${totalFetched} across ${pageCount} pages using offset-based pagination`);
    return {
      threads: allThreads,
      users: allUsers,
      sort_key: '' // Not used with offset pagination
    };
  }

  private parseComment(rawComment: unknown): Comment {
    const comment = rawComment as Record<string, unknown>;
    return {
      id: Number(comment.id),
      user_id: Number(comment.user_id),
      thread_id: Number(comment.thread_id),
      parent_id: comment.parent_id ? Number(comment.parent_id) : null,
      content: String(comment.content || ''),
      document: String(comment.document || ''),
      type: (comment.type as string) === 'answer' ? 'answer' : 'comment',
      number: Number(comment.number),
      created_at: String(comment.created_at),
      updated_at: String(comment.updated_at || comment.created_at),
      is_anonymous: Boolean(comment.is_anonymous),
      comments: Array.isArray(comment.comments) ? comment.comments.map((c: unknown) => this.parseComment(c)) : []
    };
  }

  async getThreadDetails(threadId: number): Promise<ThreadDetails> {
    const data = await this.makeRequest<{ thread?: unknown }>(`/threads/${threadId}?view=1`);

    if (!data.thread) {
      throw new Error('Invalid API response: missing thread data');
    }

    const thread = data.thread as Record<string, unknown>;

    return {
      id: Number(thread.id),
      user_id: Number(thread.user_id),
      course_id: Number(thread.course_id),
      title: String(thread.title || ''),
      content: String(thread.content || ''),
      document: String(thread.document || ''),
      category: String(thread.category || ''),
      type: String(thread.type || ''),
      number: Number(thread.number),
      created_at: String(thread.created_at),
      updated_at: String(thread.updated_at),
      is_anonymous: Boolean(thread.is_anonymous),
      reply_count: Number(thread.reply_count || 0),
      accepted_id: thread.accepted_id ? Number(thread.accepted_id) : null,
      answers: Array.isArray(thread.answers) ? thread.answers.map((answer: unknown) => this.parseComment(answer)) : [],
      comments: Array.isArray(thread.comments) ? thread.comments.map((comment: unknown) => this.parseComment(comment)) : []
    };
  }

  // Vector search methods
  private ensureVectorClient(): VectorClient {
    if (!this.vectorClient) {
      throw new Error('Vector client not configured. Please provide vectorConfig in constructor.');
    }
    return this.vectorClient;
  }

  /**
   * Sync all threads for a course to vector database
   */
  async syncCourseVectors(
    courseId: number,
    options: {
      forceFullSync?: boolean;
      sinceDate?: Date;
    } = {}
  ): Promise<VectorSyncResult> {
    const vectorClient = this.ensureVectorClient();
    const { forceFullSync = false, sinceDate } = options;

    if (forceFullSync) {
      // Full sync - get all threads with details
      console.log(`Starting full sync for course ${courseId}...`);
      const threadsResponse = await this.getAllCourseThreads(courseId);
      console.log(`Found ${threadsResponse.threads.length} threads to sync`);

      const threadDetails: ThreadDetails[] = [];
      const failedThreads: number[] = [];

      // Process threads in parallel batches with no delays for maximum speed
      const concurrency = 50; // High concurrency for maximum speed
      const threads = threadsResponse.threads;
      
      for (let i = 0; i < threads.length; i += concurrency) {
        const batch = threads.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (thread) => {
          try {
            const details = await this.withRetry(
              () => this.getThreadDetails(thread.id),
              5, // More retries to ensure we don't lose threads
              `Getting details for thread ${thread.id}`
            );
            return { success: true, details, threadId: thread.id };
          } catch (error) {
            console.warn(`Failed to get details for thread ${thread.id} after 5 retries:`, error);
            failedThreads.push(thread.id);
            return { success: false, details: null, threadId: thread.id };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Collect successful results
        for (const result of batchResults) {
          if (result.success && result.details) {
            threadDetails.push(result.details);
          }
        }

        const processed = i + batch.length;
        console.log(`Processed ${processed}/${threads.length} threads (${Math.round(processed/threads.length*100)}%) - ${threadDetails.length} successful, ${failedThreads.length} failed`);
      }

      if (failedThreads.length > 0) {
        console.warn(`Failed to fetch details for ${failedThreads.length} threads: ${failedThreads.join(', ')}`);
      }

      console.log(`Upserting ${threadDetails.length} thread details to vector database...`);
      return vectorClient.upsertThreadsBatch(threadDetails, courseId);
    }
    // Delta sync - use provided date or default to reasonable timeframe
    const deltaDate = sinceDate || (() => {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() - 7); // Default to 7 days if no date provided
      return defaultDate;
    })();

    console.log(`Starting delta sync for course ${courseId} since ${deltaDate.toISOString()}...`);
    const recentThreads = await this.getAllCourseThreads(courseId, deltaDate);
    console.log(`Found ${recentThreads.threads.length} updated threads to sync`);

    const threadDetails: ThreadDetails[] = [];
    const failedThreads: number[] = [];

    // Process delta threads in parallel batches with no delays for maximum speed
    const concurrency = 30; // Slightly lower concurrency for delta sync
    const threads = recentThreads.threads;
    
    for (let i = 0; i < threads.length; i += concurrency) {
      const batch = threads.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (thread) => {
        try {
          const details = await this.withRetry(
            () => this.getThreadDetails(thread.id),
            5, // More retries to ensure we don't lose threads
            `Getting details for thread ${thread.id}`
          );
          return { success: true, details, threadId: thread.id };
        } catch (error) {
          console.warn(`Failed to get details for thread ${thread.id} after 5 retries:`, error);
          failedThreads.push(thread.id);
          return { success: false, details: null, threadId: thread.id };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Collect successful results
      for (const result of batchResults) {
        if (result.success && result.details) {
          threadDetails.push(result.details);
        }
      }

      const processed = i + batch.length;
      console.log(`Processed ${processed}/${threads.length} updated threads (${Math.round(processed/threads.length*100)}%) - ${threadDetails.length} successful, ${failedThreads.length} failed`);
    }

    if (failedThreads.length > 0) {
      console.warn(`Failed to fetch details for ${failedThreads.length} threads: ${failedThreads.join(', ')}`);
    }

    return vectorClient.deltaSyncCourse(threadDetails, courseId, deltaDate);
  }

  /**
   * Search for content within a specific course
   */
  async searchCourse(
    query: string,
    courseId: number,
    options: {
      topK?: number;
      includeMetadata?: boolean;
      contentTypes?: ('thread' | 'answer' | 'comment')[];
    } = {}
  ): Promise<SearchResult[]> {
    const vectorClient = this.ensureVectorClient();
    const { topK = 10, includeMetadata = true, contentTypes } = options;

    let filter: string | undefined;
    if (contentTypes && contentTypes.length > 0) {
      // Create metadata filter for specific content types
      const typeFilters = contentTypes.map(type => `type = '${type}'`).join(' OR ');
      filter = `(${typeFilters})`;
    }

    return vectorClient.searchCourse(query, courseId, {
      topK,
      includeMetadata,
      filter,
    });
  }


  /**
   * Get specific vectors by their IDs
   */
  async getVectorsByIds(
    ids: string[],
    courseId: number,
    options: {
      includeMetadata?: boolean;
      includeData?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const vectorClient = this.ensureVectorClient();
    return vectorClient.getVectorsByIds(ids, courseId, options);
  }

  /**
   * Delete vectors for a specific thread
   */
  async deleteThreadVectors(threadId: number, courseId: number): Promise<number> {
    const vectorClient = this.ensureVectorClient();
    return vectorClient.deleteThread(threadId, courseId);
  }

  /**
   * Delete all vectors for a course
   */
  async deleteCourseVectors(courseId: number): Promise<void> {
    const vectorClient = this.ensureVectorClient();
    await vectorClient.deleteCourse(courseId);
  }

  /**
   * Get statistics about vectorized content for a course
   */
  async getCourseVectorStats(courseId: number): Promise<{
    totalVectors: number;
    threadVectors: number;
    answerVectors: number;
    commentVectors: number;
  }> {
    const vectorClient = this.ensureVectorClient();
    return vectorClient.getCourseStats(courseId);
  }

  /**
   * Sync vectors for threads updated since a specific date
   */
  async syncVectorsSince(courseId: number, sinceDate: Date): Promise<VectorSyncResult> {
    return this.syncCourseVectors(courseId, { sinceDate });
  }


  /**
   * Sync multiple courses with vectors
   */
  async syncMultipleCourses(
    courseIds: number[],
    options: {
      forceFullSync?: boolean;
      sinceDate?: Date;
      concurrency?: number;
    } = {}
  ): Promise<Record<number, VectorSyncResult>> {
    const { concurrency = 3 } = options; // Limit concurrent syncs to avoid overwhelming APIs
    const results: Record<number, VectorSyncResult> = {};

    console.log(`Starting sync for ${courseIds.length} courses with concurrency ${concurrency}...`);

    // Process courses in batches to control concurrency
    for (let i = 0; i < courseIds.length; i += concurrency) {
      const batch = courseIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (courseId) => {
        try {
          console.log(`Starting sync for course ${courseId}...`);
          const result = await this.syncCourseVectors(courseId, options);
          results[courseId] = result;
          console.log(`Completed sync for course ${courseId}: ${result.upserted} upserted, ${result.errors.length} errors`);
          return { courseId, result };
        } catch (error) {
          console.error(`Failed to sync course ${courseId}:`, error);
          results[courseId] = {
            upserted: 0,
            deleted: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
          return { courseId, result: results[courseId] };
        }
      });

      await Promise.all(batchPromises);
      console.log(`Completed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(courseIds.length / concurrency)}`);
    }

    const totalUpserted = Object.values(results).reduce((sum, r) => sum + r.upserted, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
    console.log(`Sync completed: ${totalUpserted} total vectors upserted, ${totalErrors} total errors`);

    return results;
  }
}