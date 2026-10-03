import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  type WheelEvent,
} from "react";
import { FIRST_YEAR, LAST_YEAR } from "@/config";
import type { FeedStatus } from "@/data/useEvents";
import { cn } from "@/lib/utils";

const YEARS = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
);

/** Wheel or trackpad travel per year step, in pixels. */
const WHEEL_STEP_PX = 80;
/** A pause this long between wheel events starts a fresh gesture. */
const WHEEL_IDLE_MS = 250;

const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -5,
  PageUp: 5,
};

function clampYear(year: number): number {
  return Math.min(LAST_YEAR, Math.max(FIRST_YEAR, year));
}

/** Position along the track, 0% for the first year to 100% for the last. */
function percentOf(year: number): string {
  return `${((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * 100}%`;
}

function statusLabel(status: FeedStatus, count: number): string {
  if (status === "loading") return "Loading";
  if (status === "offline") return "Offline";
  return `${count} ${count === 1 ? "point" : "points"}`;
}

interface TimelineProps {
  year: number;
  onChange(year: number): void;
  /** Points drawn for the selected year. */
  count: number;
  status: FeedStatus;
}

/**
 * Year scrubber along the bottom of the screen. Drag or click the ruler, use
 * the arrow buttons or keys, or scroll the wheel over it to step a year.
 */
export function Timeline({ year, onChange, count, status }: TimelineProps) {
  const wheel = useRef({ travel: 0, at: 0 });

  const go = (next: number) => {
    const clamped = clampYear(next);
    if (clamped !== year) onChange(clamped);
  };

  const yearAt = (track: HTMLElement, clientX: number) => {
    const { left, width } = track.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - left) / width));
    return FIRST_YEAR + Math.round(t * (LAST_YEAR - FIRST_YEAR));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    go(yearAt(e.currentTarget, e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    go(yearAt(e.currentTarget, e.clientX));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (e.key === "Home") next = FIRST_YEAR;
    else if (e.key === "End") next = LAST_YEAR;
    else if (e.key in KEY_STEPS) next = year + KEY_STEPS[e.key];
    else return;
    e.preventDefault();
    go(next);
  };

  // At most one year per event, so a fast flick doesn't skip a decade.
  const onWheel = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? delta * 16 : delta;
    const w = wheel.current;
    if (e.timeStamp - w.at > WHEEL_IDLE_MS) w.travel = 0;
    w.at = e.timeStamp;
    w.travel += px;
    if (Math.abs(w.travel) >= WHEEL_STEP_PX) {
      go(year + Math.sign(w.travel));
      w.travel = 0;
    }
  };

  return (
    <section
      aria-label="Timeline"
      onWheel={onWheel}
      className="pointer-events-auto engraved border border-border bg-panel px-1.5 pt-2.5 pb-1.5"
    >
      <div className="flex items-baseline justify-between px-3">
        <span className="font-display text-3xl leading-none tabular-nums mx-auto">
          {year}
        </span>
      </div>

      <div className="flex items-center">
        <StepButton
          label="Previous year"
          disabled={year <= FIRST_YEAR}
          onClick={() => go(year - 1)}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </StepButton>

        {/* Side padding leaves room for the end labels, which centre on their ticks. */}
        <div className="min-w-0 flex-1 px-4">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Year"
            aria-valuemin={FIRST_YEAR}
            aria-valuemax={LAST_YEAR}
            aria-valuenow={year}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
            className="focus-ring relative h-11 cursor-pointer touch-none select-none"
          >
            <div className="absolute inset-x-0 top-6 h-px bg-border" />
            {YEARS.map((y) => {
              // Labelled every four years on phones, every two from `sm`.
              const major = (y - FIRST_YEAR) % 4 === 0;
              const minor = !major && (y - FIRST_YEAR) % 2 === 0;
              return (
                <div
                  key={y}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: percentOf(y) }}
                >
                  <div
                    className={cn(
                      "mx-auto w-px bg-border",
                      major || minor ? "mt-4 h-2" : "mt-5 h-1",
                    )}
                  />
                  {(major || minor) && (
                    <div
                      className={cn(
                        "label-caps mt-1 tabular-nums transition-colors duration-150",
                        y === year
                          ? "text-foreground"
                          : "text-muted-foreground",
                        minor && "hidden sm:block",
                      )}
                    >
                      {y}
                    </div>
                  )}
                </div>
              );
            })}
            <div
              aria-hidden
              className="absolute top-2.5 h-4 w-0.75 -translate-x-1/2 bg-foreground transition-[left] duration-200 ease-out motion-reduce:transition-none"
              style={{ left: percentOf(year) }}
            />
          </div>
        </div>

        <StepButton
          label="Next year"
          disabled={year >= LAST_YEAR}
          onClick={() => go(year + 1)}
        >
          <ChevronRight aria-hidden className="size-4" />
        </StepButton>
      </div>
    </section>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring grid size-9 flex-none place-items-center text-foreground transition-colors duration-150 hover:bg-foreground/10 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
