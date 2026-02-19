import { useState, useRef, useEffect } from "react";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { drinkingBuddy } from "../data/drinkingBuddy";
import { wildcard } from "../data/wildcard";
import { getRandomItem } from "../utils/gameUtils";

interface Question {
  id: string | number;
  en: string;
  no: string;
}

/**
 * Shape returned by the Convex `questions.getAllQuestions` query.
 * Every field is an array of `Question` (or a rules variant).
 */
export interface ConvexQuestionData {
  truth: Question[];
  dare: Question[];
  never: Question[];
  point: Question[];
  drinkingbuddy: Question[];
  wildcardOne: Question[];
  wildcardAll: Question[];
  newRules?: any[];
}

export default function useQuestionState(convexData?: ConvexQuestionData | null) {

  // ─── Local fallback data ──────────────────────────────────────────────
  const makeLocalUnread = () => ({
    truth: [...truthOrDare.truth],
    dare: [...truthOrDare.dare],
    never: [...neverHaveIEver],
    point: [...pointAtSomeone],
    drinkingbuddy: [...drinkingBuddy],
    wildcardOne: [...wildcard.onePlayer],
    wildcardAll: [...wildcard.allPlayers],
  });

  /**
   * Merge Convex data with local fallback on a per-category basis.
   * Only categories that have at least one entry from Convex get replaced;
   * the rest keep the local data so we never end up with an empty deck.
   */
  const makeUnreadFromConvex = (data: ConvexQuestionData) => {
    const local = makeLocalUnread();
    return {
      truth:        data.truth.length        > 0 ? [...data.truth]        : local.truth,
      dare:         data.dare.length         > 0 ? [...data.dare]         : local.dare,
      never:        data.never.length        > 0 ? [...data.never]        : local.never,
      point:        data.point.length        > 0 ? [...data.point]        : local.point,
      drinkingbuddy:data.drinkingbuddy.length> 0 ? [...data.drinkingbuddy]: local.drinkingbuddy,
      wildcardOne:  data.wildcardOne.length  > 0 ? [...data.wildcardOne]  : local.wildcardOne,
      wildcardAll:  data.wildcardAll.length  > 0 ? [...data.wildcardAll]  : local.wildcardAll,
    };
  };

  /** Returns true if at least one Convex category has data. */
  const hasAnyConvexData = (data: ConvexQuestionData) =>
    data.truth.length > 0 ||
    data.dare.length > 0 ||
    data.never.length > 0 ||
    data.point.length > 0 ||
    data.drinkingbuddy.length > 0 ||
    data.wildcardOne.length > 0 ||
    data.wildcardAll.length > 0;

  const makeInitialUnread = () => {
    if (convexData && hasAnyConvexData(convexData)) {
      return makeUnreadFromConvex(convexData);
    }
    return makeLocalUnread();
  };

  const makeInitialRead = () => ({
    truth: [] as Question[],
    dare: [] as Question[],
    never: [] as Question[],
    point: [] as Question[],
    drinkingbuddy: [] as Question[],
    wildcardOne: [] as Question[],
    wildcardAll: [] as Question[],
  });

  const [unread, setUnread] = useState(makeInitialUnread);
  const [read, setRead] = useState(makeInitialRead);

  // Refs mirror state for synchronous access (needed for card queue pre-generation)
  const unreadRef = useRef(makeInitialUnread());
  const readRef = useRef(makeInitialRead());

  // Track whether we have already ingested Convex data for the current session.
  const convexIngestedRef = useRef(false);

  // When Convex data arrives (or changes), replace the unread decks.
  // Only do this once per data identity to avoid resetting mid-game.
  useEffect(() => {
    if (!convexData || !hasAnyConvexData(convexData)) return;
    if (convexIngestedRef.current) return;
    convexIngestedRef.current = true;

    console.log("[useQuestionState] Loaded questions from Convex DB");
    const freshUnread = makeUnreadFromConvex(convexData);
    const freshRead = makeInitialRead();
    unreadRef.current = freshUnread;
    readRef.current = freshRead;
    setUnread(freshUnread);
    setRead(freshRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convexData]);

  type CategoryKey = keyof typeof unread;

  // Sync both React state and refs together
  const syncUnread = (next: ReturnType<typeof makeInitialUnread>) => {
    unreadRef.current = next;
    setUnread(next);
  };

  const syncRead = (next: ReturnType<typeof makeInitialRead>) => {
    readRef.current = next;
    setRead(next);
  };

  const pickQuestion = (categoryKey: CategoryKey): Question => {
    let categoryUnread = [...(unreadRef.current[categoryKey] as Question[])];
    let categoryRead = [...(readRef.current[categoryKey] as Question[])];

    // Safety: if both decks are completely empty, reload from local fallback
    if (categoryUnread.length === 0 && categoryRead.length === 0) {
      console.warn(`[useQuestionState] Empty deck for "${categoryKey}" — reloading local fallback`);
      const local = makeLocalUnread();
      categoryUnread = [...(local[categoryKey] as Question[])];
      if (categoryUnread.length === 0) {
        // Even local data is empty — return a placeholder
        return { id: "fallback", en: "Press next!", no: "Trykk neste!" };
      }
    }

    if (categoryUnread.length > 0) {
      const questionObj = getRandomItem(categoryUnread);
      categoryUnread = categoryUnread.filter((q) => q.id !== questionObj.id);
      categoryRead.push(questionObj);

      syncUnread({ ...unreadRef.current, [categoryKey]: categoryUnread });
      syncRead({ ...readRef.current, [categoryKey]: categoryRead });

      return questionObj;
    }

    // unread is empty - reset the cycle by moving read back to unread
    const resetUnread = [...categoryRead];
    const questionObj = getRandomItem(resetUnread);
    const newUnread = resetUnread.filter((q) => q.id !== questionObj.id);
    const newRead = [questionObj];

    syncUnread({ ...unreadRef.current, [categoryKey]: newUnread });
    syncRead({ ...readRef.current, [categoryKey]: newRead });

    return questionObj;
  };

  const resetAllQuestions = () => {
    const freshUnread = makeInitialUnread();
    const freshRead = makeInitialRead();
    unreadRef.current = freshUnread;
    readRef.current = freshRead;
    setUnread(freshUnread);
    setRead(freshRead);
  };

  return {
    unread,
    read,
    pickQuestion,
    resetAllQuestions,
  };
}
