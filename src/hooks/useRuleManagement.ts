import { useState, useRef, useEffect } from "react";
import { newRules as localNewRules } from "../data/newRule";
import { getRandomRounds } from "../utils/gameUtils";
import type { LanguageCode } from "./useLanguage";

export default function useRuleManagement(language: LanguageCode, convexRules?: any[] | null) {
  // Use Convex rules when available and non-empty, otherwise fallback to local
  const allRulesSource = (convexRules && convexRules.length > 0) ? convexRules : localNewRules;
  const allRulesRef = useRef(allRulesSource);
  allRulesRef.current = allRulesSource;

  const [availableRules, setAvailableRules] = useState<any[]>([...allRulesSource]);
  const [activeRules, setActiveRules] = useState<any[]>([]);
  const [repelMessage, setRepelMessage] = useState<string>("");
  const [repelActive, setRepelActive] = useState<boolean>(false);

  // Track whether Convex rules have been ingested
  const convexRulesIngestedRef = useRef(false);

  useEffect(() => {
    if (!convexRules || convexRules.length === 0) return;
    if (convexRulesIngestedRef.current) return;
    convexRulesIngestedRef.current = true;
    console.log("[useRuleManagement] Loaded rules from Convex DB");
    setAvailableRules([...convexRules]);
  }, [convexRules]);

  // Refs mirror state for synchronous access (needed for card queue pre-generation)
  const activeRulesRef = useRef<any[]>([]);
  const repelActiveRef = useRef(false);

  // Sync helpers: update both ref and React state
  const syncActiveRules = (next: any[]) => {
    activeRulesRef.current = next;
    setActiveRules(next);
  };

  const syncRepelActive = (next: boolean) => {
    repelActiveRef.current = next;
    setRepelActive(next);
  };

  const replaceActiveRules = (nextActiveRules: any[]) => {
    const normalized = Array.isArray(nextActiveRules) ? nextActiveRules : [];
    syncActiveRules(normalized);
    // Keep availableRules in sync (important for host refresh / late join).
    const activeIds = new Set(normalized.map((r) => r?.id).filter(Boolean));
    setAvailableRules(allRulesRef.current.filter((r) => !activeIds.has(r.id)));
  };

  const updateActiveRules = (baseActiveRules?: any[]) => {
    const rules = baseActiveRules ?? activeRulesRef.current;
    if (!Array.isArray(rules) || rules.length === 0) {
      return { expiredRule: null, activeRules: [] };
    }

    let ruleExpired = null;

    const updated = rules.map((rule) => {
      const currentRounds = typeof rule.roundsLeft === "number" ? rule.roundsLeft : 0;
      const newRounds = currentRounds - 1;
      if (newRounds <= 0 && !ruleExpired) ruleExpired = rule;
      return { ...rule, roundsLeft: newRounds };
    });

    if (ruleExpired) {
      const stillActive = updated.filter((r) => r.id !== ruleExpired.id);
      syncActiveRules(stillActive);
      setRepelMessage(language === "en" ? ruleExpired.repelEn : ruleExpired.repelNo);
      syncRepelActive(true);
      return { expiredRule: ruleExpired, activeRules: stillActive };
    }

    syncActiveRules(updated);
    return { expiredRule: null, activeRules: updated };
  };

  const addRule = (rule: any, baseActiveRules?: any[]) => {
    const base = baseActiveRules ?? activeRulesRef.current;
    // If roundsLeft is already pre-computed (deferred queue activation), use it.
    const ruleWithRounds = (typeof rule.roundsLeft === "number" && rule.roundsLeft > 0)
      ? { ...rule }
      : { ...rule, roundsLeft: getRandomRounds() };
    const nextActive = [...(Array.isArray(base) ? base : []), ruleWithRounds];
    syncActiveRules(nextActive);
    setAvailableRules((prev) => prev.filter((r) => r.id !== rule.id));
    return { rule: ruleWithRounds, activeRules: nextActive };
  };

  const clearRepel = () => {
    syncRepelActive(false);
    setRepelMessage("");
  };

  const resetRules = () => {
    setAvailableRules([...allRulesRef.current]);
    syncActiveRules([]);
    setRepelMessage("");
    syncRepelActive(false);
  };

  return {
    availableRules,
    activeRules,
    activeRulesRef,
    repelMessage,
    repelActive,
    repelActiveRef,
    updateActiveRules,
    addRule,
    clearRepel,
    replaceActiveRules,
    resetRules,
  };
}
