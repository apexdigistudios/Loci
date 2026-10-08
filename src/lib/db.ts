import Dexie, { Table } from "dexie";

export interface OfflineSession {
  id: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
  user_reminder_mins?: number;
  contact_reminder_mins?: number;
  last_user_checkin_at?: string;
  current_lat?: number;
  current_lng?: number;
  updated_at?: string;
}

export interface OfflineContact {
  id: string;
  name: string;
  phone: string;
  isLociUser?: boolean;
  avatar_url?: string;
  group_category?: string;
  contact_user_id?: string;
}

export interface OfflineQueueItem {
  id?: number;
  action_type: "safe_checkin" | "complete_session" | "update_location";
  payload: Record<string, unknown>;
  created_at: string;
}

export class DelociDatabase extends Dexie {
  checkin_sessions!: Table<OfflineSession, string>;
  trusted_contacts!: Table<OfflineContact, string>;
  offline_queue!: Table<OfflineQueueItem, number>;

  constructor() {
    super("DelociDB");
    this.version(1).stores({
      checkin_sessions: "id, status, expected_arrival_at",
      trusted_contacts: "id, group_category, isLociUser",
      offline_queue: "++id, action_type, created_at",
    });
  }
}

export const db = new DelociDatabase();