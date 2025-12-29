import { IoClose } from "react-icons/io5";

export default function CheerzsRulesPopup({ onClose }) {
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
          Welcome to Cheerzs! The rules of the game: the host is the leader of the game and
          responsible for drawing the cards and reading them out loud for the rest of the party.
          Each card belongs to a category, and the rules for each category are as follows:
        </p>

        <ul className="cheerzs-rules-list">
          <li>
            Truth - the chosen one must answer the question truthfully, or drink 5 sips.
          </li>
          <li>
            Dare - the chosen one must do the dare, or drink 5 sips.
          </li>
          <li>
            Who's Most Likely To... - everyone points at the person most likely to do what the
            card says. The one with the most fingers pointing at them drinks.
          </li>
          <li>
            Never Have I Ever - this one's a classic, if you have ever done what the card says,
            you drink.
          </li>
          <li>
            New Rule (and Rule Repealed) - the card introduces a new rule to the game! Everyone
            must follow it until it is repealed. If you forget the rule, you drink.
          </li>
          <li>
            Drinkingbuddy - the card picks two people to be drinkingbuddies. If one of them
            drinks, the other one drinks too.
          </li>
          <li>
            Wildcard - play the game to figure this one out! Cheerzs
          </li>
        </ul>

        <button type="button" className="popup-done-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
