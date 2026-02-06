import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

type RuleItem = { title: string; text: string };

export default function GameRules({ language = "en" }: { language?: LanguageCode }) {
  const i18n = translations[language] || translations.en;
  const fallback = translations.en;

  const intro = i18n.ui.gameRulesIntro || fallback.ui.gameRulesIntro;
  const rules = (Array.isArray(i18n.ui.gameRulesList) ? i18n.ui.gameRulesList : fallback.ui.gameRulesList) as RuleItem[];

  return (
    <div className="cheerzs-rules-content" key={language}>
      <h3>{i18n.ui.gameRules || "Game Rules"}</h3>
      <p>{intro}</p>
      <ul className="cheerzs-rules-list">
        {rules.map((rule) => (
          <li key={rule.title}>
            <em>{rule.title}</em> - {rule.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
