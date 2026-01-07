import { useState } from "react";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { drinkingBuddy } from "../data/drinkingBuddy";
import { wildcard } from "../data/wildcard";
import { getRandomItem } from "../utils/gameUtils";

export default function useQuestionState() {
  type Question = any;

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
    truth: [],
    dare: [],
    never: [],
    point: [],
    drinkingbuddy: [],
    wildcardOne: [],
    wildcardAll: [],
  });

  const [unread, setUnread] = useState(makeInitialUnread);
  const [read, setRead] = useState(makeInitialRead);

  type CategoryKey = keyof typeof unread;

  const pickQuestion = (categoryKey: CategoryKey): Question => {
    let categoryUnread = [...(unread[categoryKey] as Question[])];
    let categoryRead = [...(read[categoryKey] as Question[])];

    if (categoryUnread.length > 0) {
      const questionObj = getRandomItem(categoryUnread) as Question;
      categoryUnread = categoryUnread.filter((q: any) => q.id !== questionObj.id);
      categoryRead.push(questionObj);

      setUnread((prev) => ({ ...prev, [categoryKey]: categoryUnread }));
      setRead((prev) => ({ ...prev, [categoryKey]: categoryRead }));

      return questionObj;
    }

    // unread is empty - reset the cycle by moving read back to unread
    const resetUnread = [...categoryRead];
    const questionObj = getRandomItem(resetUnread) as Question;
    const newUnread = resetUnread.filter((q: any) => q.id !== questionObj.id);
    const newRead = [questionObj];

    setUnread((prev) => ({ ...prev, [categoryKey]: newUnread }));
    setRead((prev) => ({ ...prev, [categoryKey]: newRead }));

    return questionObj;
  };

  const resetAllQuestions = () => {
    setUnread(makeInitialUnread());
    setRead(makeInitialRead());
  };

  return {
    unread,
    read,
    pickQuestion,
    resetAllQuestions,
  };
}
