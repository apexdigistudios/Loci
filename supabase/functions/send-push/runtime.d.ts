declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  interface DatabaseRow extends Record<string, unknown> {
    id: string;
    user_id: string;
    sender_id: string | null;
    phone: string;
    user_phone: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    endpoint: string;
    p256dh: string;
    auth: string;
    token_hash: string;
    expires_at: string;
    is_active: boolean;
    is_read: boolean;
    created_at: string;
    title: string;
    message: string;
    type: string;
    metadata: Record<string, unknown>;
    device_info: Record<string, unknown>;
  }

  interface QueryResult<T> {
    data: T | null;
    error: { message: string; code?: string; details?: string } | null;
    count?: number | null;
  }

  interface Query<T extends DatabaseRow> extends PromiseLike<QueryResult<T[]>> {
    insert(values: Record<string, unknown> | readonly Record<string, unknown>[]): Query<T>;
    single(): Promise<QueryResult<T>>;
    select(columns: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): Query<T>;
    eq(column: string, value: unknown): Query<T>;
    in(column: string, values: readonly unknown[]): Query<T>;
    order(column: string, options?: { ascending?: boolean }): Query<T>;
    limit(count: number): Query<T>;
    maybeSingle(): Promise<QueryResult<T>>;
    update(values: Record<string, unknown>): Query<T>;
    upsert(values: Record<string, unknown>, options?: { onConflict?: string }): Query<T>;
    is(column: string, value: null | boolean): Query<T>;
    delete(): Query<T>;
    lt(column: string, value: unknown): Query<T>;
    gt(column: string, value: unknown): Query<T>;
  }

  interface SupabaseClient {
    from<T extends DatabaseRow = DatabaseRow>(table: string): Query<T>;
    rpc(name: string, args?: Record<string, unknown>): Promise<QueryResult<boolean>>;
    auth: {
      getUser(token: string): Promise<{
        data: {
          user: {
            id: string;
            email?: string;
            user_metadata?: Record<string, unknown>;
          } | null;
        };
        error: unknown | null;
      }>;
    };
    channel(name: string, options?: Record<string, unknown>): BroadcastChannel;
    removeChannel(channel: BroadcastChannel): Promise<unknown>;
  }

  interface BroadcastChannel {
    on(type: string, filter: Record<string, unknown>, callback: (payload: { payload?: Record<string, unknown> }) => void): BroadcastChannel;
    subscribe(callback?: (status: string) => void): BroadcastChannel;
    send(payload: Record<string, unknown>): Promise<unknown>;
  }

  export function createClient(
    url: string,
    key: string,
    options?: { auth?: { persistSession?: boolean } }
  ): SupabaseClient;
}

declare module "https://esm.sh/web-push@3.6.3" {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload: string,
      options?: { headers?: Record<string, string>; TTL?: number }
    ): Promise<unknown>;
  }

  const webpush: WebPush;
  export default webpush;
}
