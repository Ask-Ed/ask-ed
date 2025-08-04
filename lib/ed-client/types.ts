export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  year: string;
  session: string;
  status: string;
  created_at: string;
}

export interface UserCourse {
  course: Course;
  last_active: string;
}

export interface EdApiResponse {
  user: {
    id: number;
    name: string;
    email: string;
  };
  courses: Array<{
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
  }>;
}

export interface ParsedUserData {
  user: User;
  courses: Array<{
    course: Course;
    last_active: string;
  }>;
}

export interface ThreadUser {
  id: number;
  name: string;
  course_role: string;
}

export interface Thread {
  id: number;
  user_id: number;
  course_id: number;
  title: string;
  content: string;
  document: string;
  category: string;
  type: string;
  number: number;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  reply_count: number;
  user: ThreadUser | null;
}

export interface ThreadsResponse {
  threads: Thread[];
  users: ThreadUser[];
  sort_key: string;
}

export interface ThreadQueryOptions {
  limit?: number;
  sort?: 'new' | 'top' | 'active';
  sort_key?: string;
  offset?: number;
}

export interface Comment {
  id: number;
  user_id: number;
  thread_id: number;
  parent_id: number | null;
  content: string;
  document: string;
  type: 'comment' | 'answer';
  number: number;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  comments: Comment[];
}

export interface ThreadDetails {
  id: number;
  user_id: number;
  course_id: number;
  title: string;
  content: string;
  document: string;
  category: string;
  type: string;
  number: number;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  reply_count: number;
  accepted_id: number | null;
  answers: Comment[];
  comments: Comment[];
}

export interface ThreadDetailsResponse {
  thread: ThreadDetails;
}

// Vector types
export interface VectorMetadata extends Record<string, any> {
  course_id: number;
  thread_id: number;
  comment_id?: number;
  type: 'thread' | 'answer' | 'comment';
  title?: string;
  content_preview: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  is_anonymous: boolean;
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata: VectorMetadata;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
  content: string;
}

export interface VectorSyncResult {
  upserted: number;
  deleted: number;
  errors: string[];
}

export interface VectorClientConfig {
  url: string;
  token: string;
}

export interface SyncState {
  course_id: number;
  last_sync_date: string;
  last_full_sync_date: string;
  total_vectors: number;
  created_at: string;
  updated_at: string;
}

export interface SyncStateManager {
  getSyncState(courseId: number): Promise<SyncState | null>;
  updateSyncState(courseId: number, updates: Partial<SyncState>): Promise<void>;
  createSyncState(courseId: number): Promise<SyncState>;
}