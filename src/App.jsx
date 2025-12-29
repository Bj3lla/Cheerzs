import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./index.css";
import useLanguage from "./hooks/useLanguage";
import { GameProvider } from "./context/GameContext";
import LanguageSelector from "./components/LanguageSelector";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import MenuPage from "./pages/MenuPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import AddPlayersManuallyPage from "./pages/AddPlayersManuallyPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";

function RoomCleanupOnLanding() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location?.pathname || "/";
    const shouldCleanup = pathname === "/" || pathname === "/join-room" || pathname === "/create-room";
    if (!shouldCleanup) return;

    const roomID = (localStorage.getItem("playerRoomId") || "").trim();
    const username = (localStorage.getItem("playerName") || "").trim();
    const playerId = (localStorage.getItem("playerId") || "").trim();

    // Only attempt cleanup when we have a plausible online session.
    if (!roomID || !username) return;

    const payload = { roomID, username, playerId };

    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/leave-room", blob);
    } catch {
      fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // ignore
      });
    }

    // Clear local room identifiers so we don't repeatedly attempt cleanup.
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerRoomId");
    try {
      sessionStorage.removeItem("joinedBeforeStartRoomId");
    } catch {
      // ignore
    }
  }, [location?.pathname]);

  return null;
}

function InnerApp({ language, setLanguage }) {
  return (
    <>
      <div className="app">
        <RoomCleanupOnLanding />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />

        <Routes>
          <Route path="/" element={<HomePage language={language} />} />
          <Route path="/game" element={<GamePage language={language} />} />
          <Route
            path="/menu"
            element={<MenuPage language={language} onLanguageChange={setLanguage} />}
          />
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
