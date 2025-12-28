import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./index.css";
import useLanguage from "./hooks/useLanguage";
import { GameProvider } from "./context/GameContext";
import { useGame } from "./context/GameContext";
import LanguageSelector from "./components/LanguageSelector";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import AddPlayersManuallyPage from "./pages/AddPlayersManuallyPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import { translations } from "./locales/translations";

function InnerApp({ language, setLanguage }) {
  const location = useLocation();
  const { roomId } = useGame();
  const i18n = translations[language] || translations.en;

  const normalizedRoomID = typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  const showRoomHeader = location.pathname === "/game" && Boolean(normalizedRoomID);

  return (
    <>
      {showRoomHeader && (
        <h3 className="room-id-header">{i18n.ui.roomID}{normalizedRoomID}</h3>
      )}

      <div className="app">
        <LanguageSelector language={language} onLanguageChange={setLanguage} />

        <Routes>
          <Route path="/" element={<HomePage language={language} />} />
          <Route path="/game" element={<GamePage language={language} />} />
          <Route path="/create-room" element={<CreateRoomPage language={language} />} />
          <Route path="/join-room" element={<JoinRoomPage language={language} />} />
          <Route path="/add-players" element={<AddPlayersManuallyPage language={language} />} />
          <Route path="/room/:roomId" element={<WaitingRoomPage language={language} />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  const { language, setLanguage } = useLanguage();

  return (
    <GameProvider language={language}>
      <BrowserRouter>
        <InnerApp language={language} setLanguage={setLanguage} />
      </BrowserRouter>
    </GameProvider>
  );
}
