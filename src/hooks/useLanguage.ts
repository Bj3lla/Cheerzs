import { useState } from "react";

export type LanguageCode = "en" | "no";

export default function useLanguage(initial: LanguageCode = "en") {
  const [language, setLanguage] = useState<LanguageCode>(initial);
  const [languageMenuOpen, setLanguageMenuOpen] = useState<boolean>(false);

  return {
    language,
    setLanguage,
    languageMenuOpen,
    setLanguageMenuOpen,
  };
}
