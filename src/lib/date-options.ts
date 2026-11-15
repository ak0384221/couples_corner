export const DATE_OPTION_CATEGORIES = [
  "mood",
  "activity",
  "food",
  "time_label",
  "creator_outfit_style",
  "creator_outfit_color",
  "partner_outfit_style",
  "partner_outfit_color",
] as const;

export type DateOptionCategory = (typeof DATE_OPTION_CATEGORIES)[number];

export type DateOption = {
  id: string;
  category: DateOptionCategory;
  label: string;
  sort_order: number;
};

export function isDateOptionCategory(value: string): value is DateOptionCategory {
  return DATE_OPTION_CATEGORIES.some((category) => category === value);
}

export const DEFAULT_DATE_OPTIONS: Record<DateOptionCategory, string[]> = {
  mood: ["Cozy", "Romantic", "Adventurous", "Silly"],
  activity: ["Walk", "Cafe", "Movie", "Picnic", "Boat ride"],
  food: ["Biryani", "Fuchka", "Pasta", "Dessert", "Coffee"],
  time_label: ["Golden hour", "Sunset", "Evening", "Late night"],
  creator_outfit_style: ["Three-piece", "Top and jeans", "Saree", "Kurti"],
  creator_outfit_color: ["Rose", "Sky", "Sage", "Lilac", "Butter"],
  partner_outfit_style: ["Panjabi", "T-shirt", "Shirt", "Polo"],
  partner_outfit_color: ["Navy", "Cream", "Black", "Maroon", "Olive"],
};
