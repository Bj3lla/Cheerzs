import { createContext, useContext, type ReactNode } from "react";
import useGameLogic from "../hooks/useGameLogic";
import type { LanguageCode } from "../hooks/useLanguage";

type GameContextValue = ReturnType<typeof useGameLogic>;

const GameContext = createContext<GameContextValue>( 
  undefined as unknown as GameContextValue 
);

export function GameProvider({
  language,
  children,
}: {
  language: LanguageCode;
  children: ReactNode;
}) {
  const game = useGameLogic(language);
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  return useContext(GameContext);
}