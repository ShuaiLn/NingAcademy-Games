export type HitStopCue = "normal_hit" | "weakpoint_hit" | "kill" | "part_break";

const REQUESTED_DURATION_MS: Readonly<Record<HitStopCue, number>> = {
  normal_hit: 20,
  weakpoint_hit: 30,
  kill: 40,
  part_break: 50,
};

interface AcceptedStop {
  readonly atMs: number;
  readonly durationMs: number;
}

/** A local presentation-only budget. It never modifies simulation time. */
export class HitStopBudget {
  readonly #maximumPerWindowMs: number;
  readonly #windowMs: number;
  #accepted: AcceptedStop[] = [];
  #enabled = true;
  #lastObservedAtMs = Number.NEGATIVE_INFINITY;

  constructor(maximumPerWindowMs = 80, windowMs = 1_000) {
    if (!Number.isFinite(maximumPerWindowMs) || maximumPerWindowMs < 0) {
      throw new RangeError("maximumPerWindowMs must be non-negative");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new RangeError("windowMs must be positive");
    }
    this.#maximumPerWindowMs = maximumPerWindowMs;
    this.#windowMs = windowMs;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
  }

  request(cue: HitStopCue, atMs: number): number {
    if (!Number.isFinite(atMs) || atMs < 0) {
      throw new RangeError("atMs must be a non-negative finite number");
    }
    if (!this.#enabled) {
      return 0;
    }

    if (atMs < this.#lastObservedAtMs) {
      this.#accepted = [];
    }
    this.#lastObservedAtMs = atMs;

    const cutoff = atMs - this.#windowMs;
    this.#accepted = this.#accepted.filter((entry) => entry.atMs > cutoff);
    const alreadyUsedMs = this.#accepted.reduce(
      (sum, entry) => sum + entry.durationMs,
      0,
    );
    const grantedMs = Math.min(
      REQUESTED_DURATION_MS[cue],
      Math.max(0, this.#maximumPerWindowMs - alreadyUsedMs),
    );

    if (grantedMs > 0) {
      this.#accepted.push({ atMs, durationMs: grantedMs });
    }
    return grantedMs;
  }
}
