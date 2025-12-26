import { useState } from "react";
import Button from "../components/Button";
import { GrLanguage } from "react-icons/gr";
import { IoClose } from "react-icons/io5";

export default function HomePage({ game, translations, language, setLanguage }) {
  const { friends, addFriend, removeFriend, setGameStarted } = game;
  const [friendInput, setFriendInput] = useState("");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const handleAddFriend = () => {
    const name = friendInput.trim();
    if (name) {
      addFriend(name);
      setFriendInput("");
    }
  };

  return (
    <div className="home-screen">
      {/* Language button */}
      <GrLanguage
        className="language-btn"
        onClick={() => setLanguageMenuOpen(true)}
        title="Change language"
      />

      {/* Language selection popup */}
      {languageMenuOpen && (
        <div className="language-popup-overlay">
          <div className="language-popup">
            <IoClose
              className="popup-close-btn"
              onClick={() => setLanguageMenuOpen(false)}
            />
            <h2>{translations[language].ui.selectLanguage}</h2>
            <div className="language-options">
              <label>
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={language === "en"}
                  onChange={() => setLanguage("en")}
                />
                🇬🇧 English
              </label>
              <label>
                <input
                  type="radio"
                  name="language"
                  value="no"
                  checked={language === "no"}
                  onChange={() => setLanguage("no")}
                />
                🇳🇴 Norsk
              </label>
            </div>
            <button
              className="popup-done-btn"
              onClick={() => setLanguageMenuOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <h1>
        {translations[language].ui.cheers}
        <br />
        {translations[language].ui.year}
      </h1>

      {/* Friend input */}
      <div className="friend-input">
        <input
          type="text"
          placeholder={translations[language].ui.placeholder}
          value={friendInput}
          onChange={(e) => setFriendInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
        />
        <Button
          label={translations[language].ui.add}
          color="accent"
          onClick={handleAddFriend}
          size="small"
        />
      </div>

      {/* Friends list */}
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

      {/* Start game button */}
      <Button
        label={translations[language].ui.startGame}
        color="primary"
        onClick={() => setGameStarted(true)}
        size="large"
        disabled={friends.length === 0}
      />
    </div>
  );
}
