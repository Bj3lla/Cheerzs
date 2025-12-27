import CreateRoom from "./CreateRoom";
import JoinRoom from "./JoinRoom";
import "../index.css";

export default function HomePage({ onRoomCreated, onRoomJoined, onManualAdd }) {
  return (
    <div className="home-wrapper">
      <h1 className="title">
        Cheerzs <br /> <span>2025</span>
      </h1>

      <AddPlayer></AddPlayer>

      <div className="buttons">
        <button className="btn purple" onClick={() => onRoomCreated()}>
          CREATE ROOM
        </button>
        <button className="btn red" onClick={() => onRoomJoined()}>
          JOIN ROOM
        </button>
      </div>

      <p className="manual-text">
        or add players manually{" "}
        <span className="link" onClick={onManualAdd}>
          here
        </span>
      </p>
    </div>
  );
}
