export const getRandomAmountOfZips = (min, max) => {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return amount === 1 ? '1 sip' : `${amount} sips` ;
};