export const EXPLORE_CATEGORIES = [
  "social_media",
  "sunnah",
  "intentional_love",
] as const;

export type ExploreCategory = (typeof EXPLORE_CATEGORIES)[number];

export type ExplorePost = {
  id: string;
  category: ExploreCategory;
  content: string;
  created_at: string;
};
