import { useState } from "react";
import { newRules } from "../data/newRule";
import { getRandomRounds } from "../utils/gameUtils";
import type { LanguageCode } from "./useLanguage";

export default function useRuleManagement(language: LanguageCode) {
  const [availableRules, setAvailableRules] = useState<any[]>([...newRules]);
  const [activeRules, setActiveRules] = useState<any[]>([]);
  const [repelMessage, setRepelMessage] = useState<string>("");
  const [repelActive, setRepelActive] = useState<boolean>(false);

  const replaceActiveRules = (nextActiveRules: any[]) => {
    const normalized = Array.isArray(nextActiveRules) ? nextActiveRules : [];
    setActiveRules(normalized);
    // Keep availableRules in sync (important for host refresh / late join).
    const activeIds = new Set(normalized.map((r) => r?.id).filter(Boolean));
    setAvailableRules(newRules.filter((r) => !activeIds.has(r.id)));
  };

  const updateActiveRules = (baseActiveRules: any[] = activeRules) => {
    if (!Array.isArray(baseActiveRules) || baseActiveRules.length === 0) {
      return { expiredRule: null, activeRules: [] };
    }

    let ruleExpired = null;

    const updated = baseActiveRules.map((rule) => {
      const currentRounds = typeof rule.roundsLeft === "number" ? rule.roundsLeft : 0;
      const newRounds = currentRounds - 1;
      if (newRounds <= 0 && !ruleExpired) ruleExpired = rule;
      return { ...rule, roundsLeft: newRounds };
    });

    if (ruleExpired) {
      const stillActive = updated.filter((r) => r.id !== ruleExpired.id);
      setActiveRules(stillActive);
      setRepelMessage(language === "en" ? ruleExpired.repelEn : ruleExpired.repelNo);
      setRepelActive(true);
      return { expiredRule: ruleExpired, activeRules: stillActive };
    }

    setActiveRules(updated);
    return { expiredRule: null, activeRules: updated };
  };

  const addRule = (rule: any, baseActiveRules: any[] = activeRules) => {
    const ruleWithRounds = { ...rule, roundsLeft: getRandomRounds() };
    const nextActive = [...(Array.isArray(baseActiveRules) ? baseActiveRules : []), ruleWithRounds];
    setActiveRules(nextActive);
    setAvailableRules((prev) => prev.filter((r) => r.id !== rule.id));
    return { rule: ruleWithRounds, activeRules: nextActive };
  };

  const clearRepel = () => {
    setRepelActive(false);
    setRepelMessage("");
  };

  const resetRules = () => {
    setAvailableRules([...newRules]);
    setActiveRules([]);
    setRepelMessage("");
    setRepelActive(false);
  };

  return {
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    updateActiveRules,
    addRule,
    clearRepel,
    replaceActiveRules,
    resetRules,
  };
}
