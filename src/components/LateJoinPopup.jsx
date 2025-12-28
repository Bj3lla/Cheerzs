import { translations } from "../locales/translations";

export default function LateJoinPopup({ message, onClose, language }) {
  const i18n = translations[language] || translations.en;
  
  return (
    <div className="language-popup-overlay" role="dialog" aria-modal="true">
      <div className="language-popup">
        <button
          type="button"
          className="popup-close-btn"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>

        <p>{message}</p>

        <button type="button" className="popup-done-btn" onClick={onClose}>
           {i18n.ui.cheers || "Cheerzs!"}
        </button>
      </div>
    </div>
  );
}
