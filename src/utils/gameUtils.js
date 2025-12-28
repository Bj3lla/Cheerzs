// Game-related utilities
export const getRandomItem = (arr) =>
  arr[Math.floor(Math.random() * arr.length)];

export const getRandomRounds = (min = 10, max = 20) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const getRandomCategory = () => {
  const random = Math.random() * 100;
  if (random < 3) return "drinkingbuddy";
  if (random < 6) return "wildcard";
  if (random < 16) return "rule";
  if (random < 40) return "point";
  if (random < 64) return "never";
  if (random < 82) return "truth";
  return "dare";
};

export const categoryColors = {
  truth: "#4169e1",
  dare: "#e91e63",
  point: "#7541dd",
  never: "#007f96",
  rule: "#b42a82",
  repeal: "#b42a82",
  drinkingbuddy: "#b42a82",
  wildcard: "#b42a82",
};

// Unused so far because not referenced in the project
export const getRandomAmountOfZips = (min, max) => {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return amount === 1 ? '1 sip' : `${amount} sips` ;
};
