import { useState } from "react";
import { GrLanguage } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import { translations } from "../locales/translations";

export default function LanguageSelector({ language, onLanguageChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const i18n = translations[language];

  const handleLanguageChange = (newLanguage) => {
    onLanguageChange(newLanguage);
  };

  return (
    <>
      <GrLanguage
        className="language-btn"
        onClick={() => setIsOpen(true)}
        title="Change language"
        size ={26}
        role="button"
        tabIndex={0}
        aria-label={i18n.ui.selectLanguage}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setIsOpen(true);
        }}
      />

      {isOpen && (
        <div className="popup-overlay" role="dialog" aria-modal="true">
          <div className="popup">
            <IoClose
              className="popup-close-btn"
              onClick={() => setIsOpen(false)}
              role="button"
              tabIndex={0}
              aria-label="Close"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setIsOpen(false);
              }}
            />
            <h3>{i18n.ui.selectLanguage}</h3>
            <div className="language-options">
              <label>
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={language === "en"}
                  onChange={() => handleLanguageChange("en")}
                />
                🇬🇧 English
              </label>
              <label>
                <input
                  type="radio"
                  name="language"
                  value="no"
                  checked={language === "no"}
                  onChange={() => handleLanguageChange("no")}
                />
                🇳🇴 Norsk
              </label>
            </div>

            <button
              className="popup-done-btn"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
