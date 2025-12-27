// Get current year in Norwegian timezone (Europe/Oslo)
const getCurrentYearNorwegian = () => {
  const norweegianTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Oslo" })
  );
  return norweegianTime.getFullYear().toString();
};

export const translations = {
  en: {
    ui: {
      add: "Add",
      startGame: "Start Game",
      editGame: "Edit Game",
      next: "Next",
      activeRules: "Active Rules",
      placeholder: "playername...",
      noMoreRules: "No more new rules available!",
      pressNext: "Press next to get a question!",
      cheers: "Cheerzs!",
      selectLanguage: "Select Language",
      createRoom: "Create Room",
      joinRoom: "Join Room",
      orAddPlayers: "...or add players manually",
      here: "here",
      year: getCurrentYearNorwegian(),
    },
    categories: {
      truth: "Truth",
      dare: "Dare",
      never: "Never Have I Ever...",
      point: "Point At Someone Who...",
      rule: "New Rule!",
      repeal: "Rule Repealed!",
    },
  },

  no: {
    ui: {
      add: "Legg til",
      startGame: "Start spill",
      editGame: "Rediger spill",
      next: "Neste",
      activeRules: "Aktive regler",
      placeholder: "spillernavn...",
      noMoreRules: "Ingen nye regler igjen!",
      pressNext: "Trykk neste for å få et spørsmål!",
      cheers: "Cheerzs!",
      selectLanguage: "Velg språk",
      createRoom: "Opprett et rom",
      joinRoom: "Bli med i et rom",
      orAddPlayers: "...eller legg til spillere manuelt",
      here: "her",
      year: getCurrentYearNorwegian(),
    },
    categories: {
      truth: "Sannhet",
      dare: "Utfordring",
      never: "Jeg har aldri...",
      point: "Pekeleken!",
      rule: "Ny regel!",
      repeal: "Regel opphevet!",
    },
  },
};