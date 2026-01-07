// Game-related utilities
export const getRandomItem = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export const getRandomRounds = (min: number = 10, max: number = 20): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export type CategoryKey =
  | "truth"
  | "dare"
  | "never"
  | "point"
  | "rule"
  | "repeal"
  | "drinkingbuddy"
  | "wildcard";

export type RandomDrawCategoryKey = Exclude<CategoryKey, "repeal">;

export const getRandomCategory = (): RandomDrawCategoryKey => {
  const random = Math.random() * 100;
  if (random < 2) return "drinkingbuddy";
  if (random < 4) return "wildcard";
  if (random < 10) return "rule";
  if (random < 36) return "point";
  if (random < 62) return "never";
  if (random < 81) return "truth";
  return "dare";
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
};

// Unused so far because not referenced in the project
export const getRandomAmountOfZips = (min: number, max: number): string => {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return amount === 1 ? '1 sip' : `${amount} sips` ;
};
