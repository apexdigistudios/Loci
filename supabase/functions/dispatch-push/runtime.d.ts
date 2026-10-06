declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };

  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  interface QueryResult<T> {
    data: T | null;
    error: { message: string } | null;
  }

  interface Query<T extends Record<string, unknown>> extends PromiseLike<QueryResult<T[]>> {
    select(columns: string): Query<T>;
    eq(column: string, value: unknown): Query<T>;
    in(column: string, values: readonly unknown[]): Query<T>;
    order(column: string, options?: { ascending?: boolean }): Query<T>;
    limit(count: number): Query<T>;
    maybeSingle(): Promise<QueryResult<T>>;
    update(values: Record<string, unknown>): Query<T>;
    is(column: string, value: null | boolean): Query<T>;
    delete(): Query<T>;
  }

  interface SupabaseClient {
    from<T extends Record<string, unknown> = Record<string, unknown>>(table: string): Query<T>;
  }

  export function createClient(
    url: string,
    key: string,
    options?: { auth?: { persistSession?: boolean } }
  ): SupabaseClient;
}

declare module "npm:web-push@3.6.7" {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload: string): Promise<unknown>;
  }

  const webpush: WebPush;
  export default webpush;
}