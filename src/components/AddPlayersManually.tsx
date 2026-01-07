import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

type FriendErrorCode = "emptyFriend" | null;

const getErrorMessage = (errorCode: FriendErrorCode, i18n: any) => {
  const errorMap: Record<Exclude<FriendErrorCode, null>, string | undefined> = {
    emptyFriend: i18n.ui.pleaseAddFriend,
  };
  return errorCode ? errorMap[errorCode] || null : null;
};

export default function AddPlayers({
  language,
  friendInput,
  setFriendInput,
  onAddFriend,
  errorCode,
}: {
  language: LanguageCode;
  friendInput: string;
  setFriendInput: (next: string) => void;
  onAddFriend: () => void;
  errorCode: FriendErrorCode;
}) {
  const i18n = translations[language] || translations.en;
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
        <Button label={i18n.ui.add} color="primary" onClick={onAddFriend} size="small" />
      </div>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </div>
  );
}
