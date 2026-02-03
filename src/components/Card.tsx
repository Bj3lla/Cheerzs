import "../index-ifi-skitur.css";

export default function Card({ prompt }: { prompt: React.ReactNode }) {
  return (
    <div className="card-container">
      <p className="card-text">{prompt}</p>
    </div>
  );
}
