
//to be implememted later! This is only brainstorming for now. Need to create UI and GameModePage too. 
export const gameModes = {
    classic: 'Classic',
    vorspiel: 'Vorspiel', //same as classic but with more sips?
    girlsNight: 'Girls Night', //girls only questions and dares
    forTheBoys: 'For The Boys', //guttastemning
    spicyMode: 'Spicy spicy',
    nachspiel: 'Nachspiel',
    reactFast: 'React Fast', //more competitive games 

    // choose only specific card types, maybe add a filter option later, so the host may choose which types to include
    customized: 'Customized', //host may choose which card types to include, should be costing money
    truthOrDare: 'Truth or Dare', //only truth or dare cards
    neverHaveIEver: 'Never Have I Ever', //only never have i ever cards
    pointAtSomeone: 'Who is most likely to...', //only point at someone cards

    //other game modes to be added later
    horseRace: 'Horse Race', //drinking game with cards and bets + the QR code to play the mp3 song
    dice: 'Dice', //drinking game with dice rolls, 'offline mode/singlemode' only, 'Opus' as the song, QR-code?
    continueWithAI: 'Continue with AI', //continue the game with AI-generated questions and dares.
};