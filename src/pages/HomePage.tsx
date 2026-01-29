import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddPlayer from "../components/AddPlayer";
import Button from "../components/Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

type PlayerNameErrorCode = "emptyPlayerName" | null;

const getErrorMessage = (errorCode: PlayerNameErrorCode, i18nData: typeof translations["en"]): string | null => {
  if (!errorCode) return null;

  const errorMap: Record<Exclude<PlayerNameErrorCode, null>, string | undefined> = {
    emptyPlayerName: i18nData.ui.pleaseEnterPlayerName,
  };

  return errorMap[errorCode] || null;
};

export default function HomePage({ language = "en" }: { language?: LanguageCode }) {
  const [playerName, setPlayerName] = useState<string>("");
  const [playerNameErrorCode, setPlayerNameErrorCode] = useState<PlayerNameErrorCode>(null);
  const navigate = useNavigate();
  const i18n = translations[language] || translations.en;
  const { ui } = i18n;

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
        {ui.cheerzs}
        <br />
        <div className="subtitle">
          {ui.ifiSkiturEdition}
        </div>
      </h1>

      <p className="intro-text">
        {ui.intro ||
          "Welcome to Cheerzs! The drinking game to get every party started. Let's jump right into it!"}
      </p>

      <div className="friend-input-spacer">
        <div className="friend-input">
          <AddPlayer
            language={language}
            value={playerName}
            onChange={(next: string) => setPlayerName(next)}
            hideButton={true}
            placeholderPlayerName={ui.placeholderPlayerName}
          />
        </div>
        {(() => {
          const errorMessage = getErrorMessage(playerNameErrorCode, i18n);
          return errorMessage ? <p className="error-message">{errorMessage}</p> : null;
        })()}

        <div className="room-buttons">
          <Button label={ui.createRoom || "Create Room"} color="accent" onClick={goCreateRoom} />
          <Button label={ui.joinRoom || "Join Room"} color="primary" onClick={goJoinRoom} />
        </div>
      </div>

      <p className="manual-add">
        {ui.orAddPlayers || "or add players manually"}{" "}
        <span className="manual-link" onClick={() => navigate("/add-players")}>
          {ui.here || "here"}
        </span>
      </p>
    </div>
  );
}
