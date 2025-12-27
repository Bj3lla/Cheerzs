import { createContext, useContext } from "react";
import useGameLogic from "../hooks/useGameLogic";

const GameContext = createContext();

export function GameProvider({ language, children }) {
  const game = useGameLogic(language);
  return (
    <GameContext.Provider value={game}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
