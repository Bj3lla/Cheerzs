import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CreateRoom from "../components/CreateRoom";
import Topbar from "../components/Topbar";
import { translations } from "../locales/translations";

export default function CreateRoomPage({ language }) {
  const navigate = useNavigate();
  const location = useLocation();
  const i18n = translations[language];

  // Get username from navigation state or localStorage
  const playerName = location.state?.playerName || localStorage.getItem("playerName") || "";

  useEffect(() => {
    if (!playerName || !playerName.trim()) {
      navigate("/", { replace: true });
    }
  }, [navigate, playerName]);

  const handleRoomCreated = ({ roomID }) => {
    navigate(`/room/${roomID}`);
  };

  return (
    <div className="create-room-page">
      <Topbar to="/" />
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>
      <CreateRoom onRoomCreated={handleRoomCreated} language={language} username={playerName} />
    </div>
  );
}
