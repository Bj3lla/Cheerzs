import "../index.css";

export default function Card({ prompt, category }) {
  return (
    <div className="card-container">
      <p className="card-text">{prompt}</p>
    </div>
  );
}
