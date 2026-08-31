/**
 * Placeholder wordmark. The real Class Builder logo file has not been
 * supplied yet (docs/PROGRESS.md "Open blockers" #1). Replace the SVG
 * below with the approved mark when it arrives — callers only depend on
 * this component's props, not its internals.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={className} role="img" aria-label="Asset Bank">
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
        aria-hidden="true"
        fill="none"
      >
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 21.5V13l7-4 7 4v8.5"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13 21.5v-5h6v5"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
