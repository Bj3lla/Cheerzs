import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddPlayer from "../components/AddPlayer";
import Button from "../components/Button";
import { translations } from "../locales/translations";

const getErrorMessage = (errorCode, i18n) => {
  const errorMap = {
    emptyPlayerName: i18n.ui.pleaseEnterPlayerName,
  };
  return errorMap[errorCode] || null;
};

export default function HomePage({ language = "en" }) {
  const [playerName, setPlayerName] = useState("");
  const [playerNameErrorCode, setPlayerNameErrorCode] = useState(null);
  const navigate = useNavigate();
  const i18n = translations[language] || translations.en;

  // Optional: persist username in localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) setPlayerName(savedName);
  }, []);

  const goCreateRoom = () => {
    if (!playerName.trim()) {
      setPlayerNameErrorCode("emptyPlayerName");
      return;
    }
    setPlayerNameErrorCode(null);
    localStorage.setItem("playerName", playerName.trim());
    navigate("/create-room", { state: { playerName: playerName.trim() } });
  };

  const goJoinRoom = () => {
    if (!playerName.trim()) {
      setPlayerNameErrorCode("emptyPlayerName");
      return;
    }
    setPlayerNameErrorCode(null);
    localStorage.setItem("playerName", playerName.trim());
    navigate("/join-room", { state: { playerName: playerName.trim() } });
  };

  return (
    <div className="home-screen">
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>

      <p className="intro-text">{i18n.ui.intro || "Welcome to Cheerzs! The drinking game to get every party started. Let's jump right into it!"}</p>

      <div className ="friend-input-spacer" > 
        <div className="friend-input">
          <AddPlayer
            language={language}
            value={playerName}
            onChange={setPlayerName}
            hideButton={true} // hide internal button
            placeholder={i18n.ui.placeholderPlayerName}
          />
        </div>
        {getErrorMessage(playerNameErrorCode, i18n) && (
          <p className="error-message">{getErrorMessage(playerNameErrorCode, i18n)}</p>
        )}
      </div>


      <div className="room-buttons">
        <Button label={i18n.ui.createRoom || "Create Room"} color="accent" onClick={goCreateRoom} />
        <Button label={i18n.ui.joinRoom || "Join Room"} color="primary" onClick={goJoinRoom} />
      </div>

      <p className="manual-add">
        {i18n.ui.orAddPlayers || "or add players manually"}{" "}
        <span className="manual-link" onClick={() => navigate("/add-players")}>
          {i18n.ui.here || "here"}
        </span>
      </p>
    </div>
  );
}
