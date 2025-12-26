import "../index.css";

export default function Button({ label, onClick, color = "default", size = "medium" }) {
  const className = `btn ${color} ${size}`;
  return (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  );
}
