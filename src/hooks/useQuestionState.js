import { useState } from "react";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { getRandomItem } from "../utils/gameUtils";

export default function useQuestionState() {
  const [unread, setUnread] = useState({
    truth: [...truthOrDare.truth],
    dare: [...truthOrDare.dare],
    never: [...neverHaveIEver],
    point: [...pointAtSomeone],
  });

  const [read, setRead] = useState({
    truth: [],
    dare: [],
    never: [],
    point: [],
  });

  const pickQuestion = (categoryKey) => {
    let categoryUnread = [...unread[categoryKey]];
    let categoryRead = [...read[categoryKey]];

    if (categoryUnread.length > 0) {
      const questionObj = getRandomItem(categoryUnread);
      categoryUnread = categoryUnread.filter((q) => q.id !== questionObj.id);
      categoryRead.push(questionObj);

      setUnread((prev) => ({ ...prev, [categoryKey]: categoryUnread }));
      setRead((prev) => ({ ...prev, [categoryKey]: categoryRead }));

      return questionObj;
    }

    const questionObj = getRandomItem(categoryRead);
    setUnread((prev) => ({ ...prev, [categoryKey]: categoryRead }));
    setRead((prev) => ({ ...prev, [categoryKey]: [] }));
    return questionObj;
  };

  return {
    unread,
    read,
    pickQuestion,
  };
}
