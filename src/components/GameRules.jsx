import { translations } from "../locales/translations"; 

export default function GameRules({ language = "en" }) {
  const i18n = translations[language] || translations.en;

  return (
        <div className="cheerzs-rules-content">
          <h3>{i18n.ui.gameRules || "Game Rules"}</h3>
          <p>
            Welcome to Cheerzs! Every card has a category, and here are the rules for each of them:
          </p>
          <ul className="cheerzs-rules-list">
            <li><em>Truth</em> - answer honestly, or drink 5 sips.</li>
            <li><em>Dare</em> - do the dare, or drink 5 sips.</li>
            <li><em>Who's Most Likely To...</em> - pointing game; the person with the most votes drinks.</li>
            <li><em>Never Have I Ever</em> - if you've done what the card says, drink.</li>
            <li><em>New Rule / Rule Repealed</em> - follow new rules until they're repealed; if you forget, you drink.</li>
            <li><em>Drinkingbuddy</em> - you're partnered up! If one drinks, both drink.</li>
            <li><em>Wildcard</em> - Play the game to find out. Cheerzs!</li>
          </ul>
        </div>
  );
}
