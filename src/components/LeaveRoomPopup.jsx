import { IoClose } from "react-icons/io5";
import { translations } from "../locales/translations";

export default function LeaveRoomPopup({ onClose, onConfirm, language }) {
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
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
        />

        <p>
          {i18n.ui.confirmLeaveRoom || "Are you sure you want to leave the room?"}
        </p>

        <button type="button" className="popup-done-btn" onClick={onConfirm}>
          {i18n.ui.leaveGame || "Leave game"}
        </button>
      </div>
    </div>
  );
}
