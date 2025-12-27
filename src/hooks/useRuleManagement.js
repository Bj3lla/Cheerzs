import { useState } from "react";
import { newRules } from "../data/newRule";
import { getRandomItem, getRandomRounds } from "../utils/gameUtils";

export default function useRuleManagement(language) {
  const [availableRules, setAvailableRules] = useState([...newRules]);
  const [activeRules, setActiveRules] = useState([]);
  const [repelMessage, setRepelMessage] = useState("");
  const [repelActive, setRepelActive] = useState(false);

  const updateActiveRules = () => {
    if (!Array.isArray(activeRules) || activeRules.length === 0) {
      return false;
    }

    let ruleExpired = null;

    const updated = activeRules.map((rule) => {
      const newRounds = rule.roundsLeft - 1;
      if (newRounds <= 0 && !ruleExpired) ruleExpired = rule;
      return { ...rule, roundsLeft: newRounds };
    });

    if (ruleExpired) {
      const stillActive = updated.filter((r) => r.id !== ruleExpired.id);
      setActiveRules(stillActive);
      setRepelMessage(language === "en" ? ruleExpired.repelEn : ruleExpired.repelNo);
      setRepelActive(true);
      return true;
    }

    setActiveRules(updated);
    return false;
  };

  const addRule = (rule) => {
    setActiveRules([...activeRules, { ...rule, roundsLeft: getRandomRounds() }]);
    setAvailableRules(availableRules.filter((r) => r.id !== rule.id));
  };

  const clearRepel = () => {
    setRepelActive(false);
    setRepelMessage("");
  };

  return {
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    updateActiveRules,
    addRule,
    clearRepel,
  };
}
