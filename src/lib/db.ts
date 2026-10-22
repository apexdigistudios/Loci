import Dexie, { Table } from "dexie";

export interface OfflineSession {
  id: string;
  user_id?: string;
  user_phone?: string;
  scope_phone?: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated" | "expired";
  user_reminder_mins?: number;
  contact_reminder_mins?: number;
  last_user_checkin_at?: string;
  current_lat?: number | null;
  current_lng?: number | null;
  metadata?: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  server_id?: string;
}

export interface OfflineContact {
  id: string;
  server_id?: string;
  user_phone?: string;
  name: string;
  phone: string;
  isLociUser?: boolean;
  avatar_url?: string;
  group_category?: string | null;
  contact_user_id?: string;
}

export interface OfflineQueueItem {
  id?: number;
  action_type:
    | "start_session"
    | "safe_checkin"
    | "complete_session"
    | "escalate_session"
    | "send_alert"
    | "update_location"
    | "add_contact"
    | "delete_contact"
    | "notification_read"
    | "notification_delete"
    | "notification_clear";
  entity_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error?: string;
}

export interface OfflineUser {
  id: string;
  phone: string;
  full_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  subscription_tier?: string | null;
  tier?: string | null;
  cached_at: string;
}

export interface OfflineRecipient {
  id: string;
  session_id: string;
  recipient_phone: string;
  contact_phone: string;
  scope_phone?: string;
}

export interface OfflineNotification {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface OfflineMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  body: string;
  created_at: string;
  status: "pending" | "sent" | "failed";
}

export interface OfflineChat {
  id: string;
  participant_ids: string[];
  title?: string;
  last_message?: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface OfflineMediaMetadata {
  id: string;
  owner_id?: string;
  session_id?: string;
  uri?: string;
  mime_type?: string;
  size?: number;
  blob?: Blob;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface OfflineContentFeed {
  id: string;
  title?: string;
  content: unknown;
  cached_at: string;
}

export class DelociDatabase extends Dexie {
  checkin_sessions!: Table<OfflineSession, string>;
  trusted_contacts!: Table<OfflineContact, string>;
  users!: Table<OfflineUser, string>;
  session_recipients!: Table<OfflineRecipient, string>;
  notifications!: Table<OfflineNotification, string>;
  chats!: Table<OfflineChat, string>;
  messages!: Table<OfflineMessage, string>;
  media_metadata!: Table<OfflineMediaMetadata, string>;
  content_feeds!: Table<OfflineContentFeed, string>;
  offline_queue!: Table<OfflineQueueItem, number>;

  constructor() {
    super("DelociDB");
    this.version(1).stores({
      checkin_sessions: "id, status, expected_arrival_at",
      trusted_contacts: "id, group_category, isLociUser",
      offline_queue: "++id, action_type, created_at",
    });
    this.version(2).stores({
      checkin_sessions: "id, user_id, user_phone, scope_phone, status, expected_arrival_at, created_at",
      trusted_contacts: "id, user_phone, group_category, isLociUser",
      users: "id, &phone, cached_at",
      session_recipients: "id, session_id, recipient_phone, contact_phone, scope_phone",
      notifications: "id, user_id, created_at, is_read",
      chats: "id, updated_at",
      messages: "id, conversation_id, created_at, status",
      media_metadata: "id, owner_id, session_id, created_at",
      content_feeds: "id, cached_at",
      offline_queue: "++id, action_type, entity_id, created_at, attempts",
    });
  }
}

export const db = new DelociDatabase();