import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import JoinRoom from "../components/JoinRoom";
import Topbar from "../components/Topbar";
import { translations } from "../locales/translations";
import { useGame } from "../context/GameContext";

export default function JoinRoomPage({ language }) {
  const navigate = useNavigate();
  const location = useLocation();
  const i18n = translations[language];

  const { setRoomSession, setGameStarted } = useGame();

  const playerName = location.state?.playerName || localStorage.getItem("playerName") || "";

  useEffect(() => {
    if (!playerName || !playerName.trim()) {
      navigate("/", { replace: true });
    }
  }, [navigate, playerName]);

  const handleRoomJoined = ({ roomID, gameStarted, startedAt }) => {
    if (gameStarted) {
      // Late joiner (joined after host pressed Start Game)
      try {
        sessionStorage.removeItem("joinedBeforeStartRoomId");
      } catch {
        // ignore
      }
      setRoomSession({ roomID, players: [] });
      setGameStarted(true);
      navigate("/game", { state: { lateJoin: true, startedAt: startedAt || null } });
      return;
    }

    // Joined before start (waiting room)
    try {
      sessionStorage.setItem("joinedBeforeStartRoomId", roomID);
    } catch {
      // ignore
    }
    navigate(`/room/${roomID}`);
  };

  return (
    <div className="join-room-page">
      <Topbar to="/" />
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>
      <JoinRoom onRoomJoined={handleRoomJoined} language={language} username={playerName} />
    </div>
  );
}
