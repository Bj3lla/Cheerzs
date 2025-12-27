import Button from "./Button";
import { translations } from "../locales/translations";

export default function AddPlayers({ language, friendInput, setFriendInput, onAddFriend }) {
  const i18n = translations[language];

  return (
    <div className="friend-input">
      <input
        type="text"
        placeholder={i18n.ui.placeholder}
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
  );
}
