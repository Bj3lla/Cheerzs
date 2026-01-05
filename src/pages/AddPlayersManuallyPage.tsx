import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import Button from "../components/Button";
import AddPlayersManually from "../components/AddPlayersManually";
import { translations } from "../locales/translations";
import Topbar from "../components/Topbar";
import type { LanguageCode } from "../hooks/useLanguage";

type FriendErrorCode = "emptyFriend" | null;

export default function AddPlayersManuallyPage({ language }: { language: LanguageCode }) {
  const navigate = useNavigate();
  const i18n = translations[language] || translations.en;
  const [friendInput, setFriendInput] = useState<string>("");
  const [friends, setFriends] = useState<string[]>([]);
  const [friendErrorCode, setFriendErrorCode] = useState<FriendErrorCode>(null);
  const {
    setGameStarted,
    generatePrompt,
    addFriend: addFriendToGame,
    removeFriend: removeFriendFromGame,
    clearRoomSession,
  } = useGame();

  useEffect(() => {
    // Local/single-mode should be fully local and not tied to any room.
    clearRoomSession();
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerRoomId");
    setFriendInput("");
    setFriends([]);
    setFriendErrorCode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFriend = () => {
    const name = friendInput.trim();
    if (!name) {
      setFriendErrorCode("emptyFriend");
      return;
    }
    if (friends.includes(name)) {
      setFriendErrorCode(null);
      return;
    }
    setFriendErrorCode(null);
    setFriends([...friends, name]);
    addFriendToGame(name);
    setFriendInput("");
  };

  const removeFriend = (friend: string) => {
    setFriends(friends.filter((f) => f !== friend));
    removeFriendFromGame(friend);
  };

  const startGame = () => {
    // Guarantee a completely fresh local-only game (no room linkage).
    clearRoomSession();
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerRoomId");

    const storedName = (localStorage.getItem("playerName") || "").trim();
    const selfName = storedName || i18n?.ui?.chosenOne || "Chosen one";

    // If the user didn't add themselves to the list, include a default name
    // so player-targeted prompts always have someone to pick.
    if (!friends.includes(selfName)) {
      setFriends((prev) => [...prev, selfName]);
      addFriendToGame(selfName);
    }

    const nextFriends = friends.includes(selfName) ? friends : [...friends, selfName];
    setGameStarted(true);
    generatePrompt();
    navigate("/game", { state: { friends: nextFriends } });
  };

  return (
    <div className="add-players-manually">
      <Topbar to="/" />
      <h1 className="home-title">
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>

      <AddPlayersManually
        language={language}
        friendInput={friendInput}
        setFriendInput={setFriendInput}
        onAddFriend={addFriend}
        errorCode={friendErrorCode}
      />

      <div className="friends-list">
        {friends.map((friend, index) => (
          <div key={index} className="friend-item">
            <span className="friend-name">{friend}</span>
            <button
              type="button"
              className="remove-btn"
              onClick={() => removeFriend(friend)}
              aria-label={`Remove ${friend}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="start-game-btn">
        <Button
          label={i18n.ui.startGame}
          color="primary"
          onClick={startGame}
          size="large"
          disabled={friends.length === 0}
        />
      </div>
    </div>
  );
}
