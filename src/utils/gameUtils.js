export const getRandomItem = (arr) =>
  arr[Math.floor(Math.random() * arr.length)];

export const getRandomRounds = (min = 10, max = 20) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const getRandomCategory = () => {
  const random = Math.random() * 100;
  if (random < 10) return "rule";
  if (random < 35) return "point";
  if (random < 60) return "never";
  if (random < 80) return "truth";
  return "dare";
};
