import { IoClose } from "react-icons/io5";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

export default function LeaveRoomPopup({
  onClose,
  onConfirm,
  language,
}: {
  onClose: () => void;
  onConfirm: () => void;
  language: LanguageCode;
}) {
  const i18n = translations[language] || translations.no;

  return (
    <div className="popup-overlay" role="dialog" aria-modal="true">
      <div className="popup">
        <IoClose
          className="popup-close-btn"
          onClick={() => {
            console.log("[LeaveRoomPopup] CLOSE BUTTON CLICKED!");
            onClose();
          }}
          role="button"
          tabIndex={0}
          aria-label="Close"
          onKeyDown={(e: React.KeyboardEvent<SVGElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              console.log("[LeaveRoomPopup] CLOSE BUTTON KEYBOARD ACTIVATED!");
              onClose();
            }
          }}
        />

        <p>{i18n.ui.confirmLeaveRoom || "Are you sure you want to leave the room?"}</p>

        <button type="button" className="popup-done-btn" onClick={() => {
          console.log("[LeaveRoomPopup] CONFIRM BUTTON CLICKED!");
          onConfirm();
        }}>
          {i18n.ui.leaveGame || "Leave game"}
        </button>
      </div>
    </div>
  );
}
