export function Wordmark() {
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <h1 className="flex items-center gap-2.5 font-display text-4xl leading-none tracking-wide uppercase">
        <svg
          aria-hidden
          viewBox="0 0 32 20"
          className="h-5 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M1 10C6 2.5 26 2.5 31 10C26 17.5 6 17.5 1 10Z" />
          <circle cx="16" cy="10" r="5" />
          <circle cx="16" cy="10" r="1.8" fill="currentColor" />
        </svg>
        Ada's Eye
      </h1>
    </div>
  );
}
