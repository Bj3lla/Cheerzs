import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./index-ifi-skitur.css";
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
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function RoomCleanupOnLanding() {
  const location = useLocation();
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);

  // Get room data if we have a room code
  const roomCode = (localStorage.getItem("playerRoomId") || "").trim();
  const room = useQuery(
    api.rooms.getRoomByCode,
    roomCode ? { code: roomCode.toUpperCase() } : "skip"
  );

  useEffect(() => {
    const pathname = location?.pathname || "/";
    const shouldCleanup = pathname === "/" || pathname === "/join-room" || pathname === "/create-room";
    if (!shouldCleanup) return;

    const username = (localStorage.getItem("playerName") || "").trim();
    const playerId = (localStorage.getItem("playerId") || "").trim();

    // Only attempt cleanup when we have all required data
    if (!roomCode || !username || !playerId || !room?._id) return;

    // Use Convex to leave the room
    const cleanupRoom = async () => {
      try {
        console.log("[RoomCleanup] Attempting to leave room", { roomCode, roomId: room._id, playerId, username });
        
        await leaveRoomMutation({
          roomId: room._id,
          playerId,
        });
        
        console.log("[RoomCleanup] Successfully left room");
      } catch (error) {
        console.log("[RoomCleanup] Failed to leave room:", error);
        // Ignore errors - user is navigating away anyway
      }
    };

    cleanupRoom();

    // Clear local room identifiers so we don't repeatedly attempt cleanup.
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerRoomId");
    try {
      sessionStorage.removeItem("joinedBeforeStartRoomId");
    } catch {
      // ignore
    }
  }, [location?.pathname, room, roomCode, leaveRoomMutation]);

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
