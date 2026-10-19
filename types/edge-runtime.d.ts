declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export type SupabaseClient = unknown;
  export function createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClient;
}

declare module "https://esm.sh/web-push@3.6.3" {
  const webpush: unknown;
  export default webpush;
}
