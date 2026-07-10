type FeedbackBannerProps = {
  type: "success" | "error";
  message: string;
  onDismiss?: () => void;
};

export default function FeedbackBanner({ type, message, onDismiss }: FeedbackBannerProps) {
  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${styles}`}
    >
      <span className="text-sm font-medium">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center justify-center rounded-lg border border-current/20 bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
