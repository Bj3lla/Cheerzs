import { useState } from "react";
import "./index.css";
import useLanguage from "./hooks/useLanguage";
import useGameLogic from "./hooks/useGameLogic";
import LanguageSelector from "./components/LanguageSelector";
import Room from "./components/Room";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";

export default function App() {
  // Language management
  const { language, setLanguage } = useLanguage();

  // Room/Multiplayer state
  const [currentRoom, setCurrentRoom] = useState(null);

  // Game state and logic
  const {
    friends,
    gameStarted,
    setGameStarted,
    category,
    prompt,
    generatePrompt,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
  } = useGameLogic(language);

  // Handle multiplayer room creation
  const handleCreateRoom = (roomId) => {
    setCurrentRoom(roomId);
  };

  // Handle joining multiplayer room
  const handleJoinRoom = (roomId) => {
    setCurrentRoom(roomId);
  };

  // Handle starting singleplayer game
  const handleStartSingleplayerGame = (playersList) => {
    // Pass players list to game state if needed
    setGameStarted(true);
    generatePrompt();
  };

  // If user is in a room, show room component
  if (currentRoom) {
    return <Room roomID={currentRoom} />;
  }

  return (
    <div className="app">
      <LanguageSelector language={language} onLanguageChange={setLanguage} />

      {!gameStarted ? (
        <HomePage
          language={language}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onStartSingleplayerGame={handleStartSingleplayerGame}
        />
      ) : (
        <GamePage
          language={language}
          category={category}
          prompt={prompt}
          repelActive={repelActive}
          repelMessage={repelMessage}
          showActiveRules={showActiveRules}
          setShowActiveRules={setShowActiveRules}
          activeRules={activeRules}
          onGeneratePrompt={generatePrompt}
          onBackToHome={() => setGameStarted(false)}
        />
      )}
    </div>
  );
}
