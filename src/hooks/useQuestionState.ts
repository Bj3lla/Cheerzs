import { useState, useRef } from "react";
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

export default function useQuestionState() {

  const makeInitialUnread = () => ({
    truth: [...truthOrDare.truth],
    dare: [...truthOrDare.dare],
    never: [...neverHaveIEver],
    point: [...pointAtSomeone],
    drinkingbuddy: [...drinkingBuddy],
    wildcardOne: [...wildcard.onePlayer],
    wildcardAll: [...wildcard.allPlayers],
  });

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
