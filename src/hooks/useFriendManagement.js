import { useEffect, useState } from "react";

export default function useFriendManagement() {
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");
  const [player, setPlayer] = useState("");

  const replaceFriends = (nextFriendsOrUpdater) => {
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

  const addFriend = (explicitName) => {
    const name = (typeof explicitName === "string" ? explicitName : friendInput).trim();
    if (name && !friends.includes(name)) {
      setFriends((prev) => [...prev, name]);
      if (typeof explicitName !== "string") {
        setFriendInput("");
      }
    }
  };

  const removeFriend = (nameToRemove) => {
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
