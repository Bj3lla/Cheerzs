import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddPlayer from "../components/AddPlayer";
import Button from "../components/Button";
import { translations } from "../locales/translations";

export default function HomePage({ language = "en" }) {
  const [playerName, setPlayerName] = useState("");
  const navigate = useNavigate();
  const i18n = translations[language] || translations.en;

  const goCreateRoom = () => {
    navigate("/create-room", { state: { playerName } });
  };

  const goJoinRoom = () => {
    navigate("/join-room", { state: { playerName } });
  };

  return (
    <div className="home-screen">
    <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>
      
      <div className="friend-input">
        <AddPlayer
          language={language}
          value={playerName}
          onChange={setPlayerName}
          hideButton={true}
          placeholder={i18n.ui.placeholder}
        />
      </div>

      <div className="room-buttons">
        <Button label={i18n.ui.createRoom || "Create Room"} color="accent" onClick={goCreateRoom} />
        <Button label={i18n.ui.joinRoom || "Join Room"} color="primary" onClick={goJoinRoom} />
      </div>

      <p className="manual-add">
        {i18n.ui.orAddPlayers || "or add players manually"} <span className="manual-link" onClick={() => navigate("/add-players")}>here</span>
      </p>
    </div>
  );
}
