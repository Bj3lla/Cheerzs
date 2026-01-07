import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function Topbar({ to }: { to?: string }) {
  const navigate = useNavigate();

  const handleBack: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e?.preventDefault?.();

    if (typeof to === "string" && to.length > 0) {
      navigate(to);
      return;
    }

    // Some navigation flows (direct link / refresh) have no usable history entry.
    if (typeof window !== "undefined" && window.history && window.history.length <= 1) {
      navigate("/");
      return;
    }
    navigate(-1);
  };

  return (
    <div className="top-bar">
      <button
        type="button"
        className="button"
        onClick={handleBack}
        title="Go back"
        aria-label="Go back to previous page"
      >
        <IoArrowBack size={24} />
      </button>
    </div>
  );
}
