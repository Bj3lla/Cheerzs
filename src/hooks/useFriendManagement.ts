import { useEffect, useState } from "react";

export default function useFriendManagement() {
  const [friends, setFriends] = useState<string[]>([]);
  const [friendInput, setFriendInput] = useState<string>("");
  const [player, setPlayer] = useState<string>("");

  const replaceFriends = (
    nextFriendsOrUpdater: string[] | ((prev: string[]) => string[])
  ) => {
    setFriends((prev) => {
      const next =
        typeof nextFriendsOrUpdater === "function"
          ? nextFriendsOrUpdater(prev)
          : nextFriendsOrUpdater;
      return Array.isArray(next) ? next : [];
    });
  };

  useEffect(() => {
    if (player && !friends.includes(player)) setPlayer("");
  }, [friends, player]);

  const addFriend = (explicitName?: string) => {
    const name = (typeof explicitName === "string" ? explicitName : friendInput).trim();
    if (name && !friends.includes(name)) {
      setFriends((prev) => [...prev, name]);
      if (typeof explicitName !== "string") {
        setFriendInput("");
      }
    }
  };

  const removeFriend = (nameToRemove: string) => {
    setFriends((prev) => prev.filter((name) => name !== nameToRemove));
    if (player === nameToRemove) setPlayer("");
  };

  return {
    friends,
    setFriends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
    replaceFriends,
  };
}
