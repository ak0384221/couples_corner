import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { ExplorePost } from "@/lib/explore-categories";
export type { ExploreCategory, ExplorePost } from "@/lib/explore-categories";

export async function getExplorePosts(): Promise<ExplorePost[]> {
  "use cache";
  cacheLife("days");
  cacheTag("explore-posts");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured for the public Explore feed.");
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("explore_posts")
    .select("id, category, content, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`Could not load Explore posts: ${error.message}`);
  return data ?? [];
}
