// Game-related utilities
export const getRandomItem = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export const getRandomRounds = (min: number = 10, max: number = 20): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export type CategoryKey =
  | "truth"
  | "dare"
  | "never"
  | "spotify"
  | "point"
  | "rule"
  | "repeal"
  | "drinkingbuddy"
  | "wildcard";

export type RandomDrawCategoryKey = Exclude<CategoryKey, "repeal">;

export const getRandomCategory = (): RandomDrawCategoryKey => {
  const random = Math.random() * 100;
  if (random < 2) return "drinkingbuddy"; // 2%
  if (random < 4) return "wildcard"; // 2%
  if (random < 8) return "rule"; // 4%
  if (random < 18) return "spotify"; // 10%
  if (random < 46) return "point"; // 28%
  if (random < 76) return "never"; // 30%
  if (random < 88) return "truth"; // 12%
  return "dare"; // 12%
};

export const categoryColors: Record<CategoryKey, string> = {
  truth: "#4169e1",
  dare: "#e91e63",
  point: "#7541dd",
  never: "#007f96",
  rule: "#b42a82",
  repeal: "#b42a82",
  drinkingbuddy: "#ff5757",
  wildcard: "#ff9800",
  spotify: "#ff9800",
};
