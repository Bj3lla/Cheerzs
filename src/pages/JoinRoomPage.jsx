import { useNavigate } from "react-router-dom";
import JoinRoom from "../components/JoinRoom";
import Topbar from "../components/Topbar";
import { translations } from "../locales/translations";

const i18n = translations.en;

export default function JoinRoomPage({ language }) {
  const navigate = useNavigate();

  const handleRoomJoined = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="join-room-page">
      <Topbar />
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>
      <JoinRoom onRoomJoined={handleRoomJoined} />
    </div>
  );
}
