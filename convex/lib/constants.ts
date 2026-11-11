/** Display labels. Safe to import from the browser (no Convex imports). */
export const CATEGORIES = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  other: "Other",
} as const;

export const CONDITIONS = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
} as const;

export type Category = keyof typeof CATEGORIES;
export type Condition = keyof typeof CONDITIONS;
