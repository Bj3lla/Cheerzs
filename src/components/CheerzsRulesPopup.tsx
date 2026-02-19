import { IoClose } from "react-icons/io5";
import { translations } from "../locales/translations";
import GameRules from "./GameRules";
import type { LanguageCode } from "../hooks/useLanguage";

export default function CheerzsRulesPopup({
  onClose,
  language = "en",
}: {
  onClose: () => void;
  language?: LanguageCode;
}) {
  const i18n = translations[language] || translations.no;

  return (
    <div className="popup-overlay" role="dialog" aria-modal="true">
      <div className="popup cheerzs-rules-popup">
        <IoClose
          className="popup-close-btn"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close"
          onKeyDown={(e: React.KeyboardEvent<SVGElement>) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
        />

        <GameRules language={language} />

        <button type="button" className="popup-done-btn" onClick={onClose}>
          {i18n.ui.done || "Done"}
        </button>
      </div>
    </div>
  );
}
