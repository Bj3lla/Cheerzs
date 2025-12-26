import { useState } from "react";

export default function useFriendManagement() {
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");
  const [player, setPlayer] = useState("");

  const addFriend = () => {
    const name = friendInput.trim();
    if (name && !friends.includes(name)) {
      setFriends((prev) => [...prev, name]);
      setFriendInput("");
    }
  };

  const removeFriend = (nameToRemove) => {
    setFriends((prev) => prev.filter((name) => name !== nameToRemove));
    if (player === nameToRemove) setPlayer("");
  };

  return {
    friends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
  };
}
