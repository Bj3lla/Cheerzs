import { useState } from "react";

export default function useLanguage(initial = "en") {
  const [language, setLanguage] = useState(initial);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  return {
    language,
    setLanguage,
    languageMenuOpen,
    setLanguageMenuOpen,
  };
}
