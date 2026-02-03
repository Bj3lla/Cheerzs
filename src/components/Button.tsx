import "../index-ifi-skitur.css";

type ButtonProps = {
  label: React.ReactNode;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  color?: string;
  size?: string;
  disabled?: boolean;
};

export default function Button({
  label,
  onClick,
  color = "default",
  size = "medium",
  disabled = false,
}: ButtonProps) {
  const className = `btn ${color} ${size}`;
  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
