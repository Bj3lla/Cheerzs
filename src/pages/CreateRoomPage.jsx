import { useNavigate } from "react-router-dom";
import CreateRoom from "../components/CreateRoom";
import Topbar from "../components/Topbar";
import { translations } from "../locales/translations";

const i18n = translations.en; // Default to English or modify as needed

export default function CreateRoomPage({ language }) {
  const navigate = useNavigate();

  const handleRoomCreated = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="create-room-page">
      <Topbar />
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>
      <CreateRoom onRoomCreated={handleRoomCreated} />
    </div>
  );
}