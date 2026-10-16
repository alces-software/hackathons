export function StarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1.8l2.62 7.15 7.58.2-5.98 4.72 2.1 7.33L12 16.9l-6.32 4.3 2.1-7.33-5.98-4.72 7.58-.2L12 1.8z" />
    </svg>
  );
}