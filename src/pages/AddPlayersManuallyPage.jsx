import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import Button from "../components/Button";
import AddPlayersManually from "../components/AddPlayersManually";
import { translations } from "../locales/translations";
import Topbar from "../components/Topbar";

export default function AddPlayersManuallyPage({ language }) {
  const navigate = useNavigate();
  const i18n = translations[language];
  const [friendInput, setFriendInput] = useState("");
  const [friends, setFriends] = useState([]);
  const [friendErrorCode, setFriendErrorCode] = useState(null);
  const {
    setGameStarted,
    generatePrompt,
    addFriend: addFriendToGame,
    removeFriend: removeFriendFromGame,
  } = useGame();

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

  const removeFriend = (friend) => {
    setFriends(friends.filter((f) => f !== friend));
    removeFriendFromGame(friend);
  };

  const startGame = () => {
    setGameStarted(true);
    generatePrompt();
    navigate("/game", { state: { friends } });
  };

  return (
    <div className="add-players-manually">
      <Topbar />
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
