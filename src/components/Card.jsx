import "../index.css";

export default function Card({ prompt }) {
  return (
    <div className="card-container">
      <p className="card-text">{prompt}</p>
    </div>
  );
}
