import Button from "./Button";
import { translations } from "../locales/translations";

const getErrorMessage = (errorCode, i18n) => {
  const errorMap = {
    emptyFriend: i18n.ui.pleaseAddFriend,
  };
  return errorMap[errorCode] || null;
};

export default function AddPlayers({ language, friendInput, setFriendInput, onAddFriend, errorCode }) {
  const i18n = translations[language];
  const errorMessage = getErrorMessage(errorCode, i18n);

  return (
    <div className="friend-input-wrapper">
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderPlayerName}
          value={friendInput}
          onChange={(e) => setFriendInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddFriend()}
        />
        <Button
          label={i18n.ui.add}
          color="primary"
          onClick={onAddFriend}
          size="small"
        />
      </div>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </div>
  );
}
