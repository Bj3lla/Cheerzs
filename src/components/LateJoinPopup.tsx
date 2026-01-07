import { IoClose } from "react-icons/io5";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

export default function LateJoinPopup({
  message,
  onClose,
  language,
}: {
  message: string;
  onClose: () => void;
  language: LanguageCode;
}) {
  const i18n = translations[language] || translations.en;

  return (
    <div className="popup-overlay" role="dialog" aria-modal="true">
      <div className="popup">
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
        <p>{message}</p>

        <button type="button" className="popup-done-btn" onClick={onClose}>
          {i18n.ui.cheers || "Cheerzs!"}
        </button>
      </div>
    </div>
  );
}
