import { useState } from "react";
import Button from "../components/Button";
import CreateRoom from "../components/CreateRoom";
import JoinRoom from "../components/JoinRoom";
import { translations } from "../locales/translations";

export default function HomePage({
  language,
  onCreateRoom,
  onJoinRoom,
  onStartSingleplayerGame,
}) {
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");

  const i18n = translations[language];

  const addFriend = () => {
    const name = friendInput.trim();
    if (name && !friends.includes(name)) {
      setFriends((prev) => [...prev, name]);
      setFriendInput("");
    }
  };

  const removeFriend = (nameToRemove) => {
    setFriends((prev) => prev.filter((name) => name !== nameToRemove));
  };

  const handleStartGame = () => {
    if (friends.length > 0) {
      onStartSingleplayerGame(friends);
    }
  };

  return (
    <div className="home-screen">
      <h1>
        {i18n.ui.cheers}
        <br />
        {i18n.ui.year}
      </h1>

      {/* Single Player Setup */}
      <section className="singleplayer-section">
        <h2>Single Player Game</h2>
        <div className="friend-input">
          <input
            type="text"
            placeholder={i18n.ui.placeholder}
            value={friendInput}
            onChange={(e) => setFriendInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFriend()}
          />
          <Button
            label={i18n.ui.add}
            color="accent"
            onClick={addFriend}
            size="small"
          />
        </div>

        <div className="friends-list">
          {friends.map((friend, index) => (
            <div key={index} className="friend-item">
              <span>{friend}</span>
              <button
                className="remove-btn"
                onClick={() => removeFriend(friend)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <Button
          label={i18n.ui.startGame}
          color="primary"
          onClick={handleStartGame}
          size="large"
          disabled={friends.length === 0}
        />
      </section>

      {/* Multiplayer Setup */}
      <section className="multiplayer-section">
        <h2>Multiplayer Game</h2>
        <CreateRoom onRoomCreated={onCreateRoom} />
        <hr />
        <JoinRoom onRoomJoined={onJoinRoom} />
      </section>
    </div>
  );
}
