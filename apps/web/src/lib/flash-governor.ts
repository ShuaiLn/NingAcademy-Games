export type FlashMode = "off" | "reduced" | "normal";

export interface FlashRequest {
  /** Stable identifier used by diagnostics and visual-regression recordings. */
  readonly cueId: string;
  /** Monotonic presentation-clock time. Wall-clock time must not be used. */
  readonly atMs: number;
  /** Only high-contrast changes count against the global flash budget. */
  readonly highContrast: boolean;
  /** Saturated-red flashes are never permitted by the game art direction. */
  readonly saturatedRed: boolean;
}

export type FlashDecision =
  | { readonly kind: "render"; readonly cueId: string }
  | {
      readonly kind: "fallback";
      readonly cueId: string;
      readonly reason: "disabled" | "reduced_motion" | "saturated_red" | "rate_limited";
    };

export interface FlashGovernorOptions {
  readonly maxHighContrastFlashes?: number;
  readonly mode?: FlashMode;
  readonly windowMs?: number;
}

const DEFAULT_WINDOW_MS = 1_000;
const DEFAULT_MAX_FLASHES = 2;

/**
 * Coordinates every high-contrast effect through one rolling budget.
 *
 * The product limit is deliberately stricter than WCAG's three-flash
 * threshold. Callers must render their non-flashing outline/text/audio
 * fallback whenever this class returns `fallback`.
 */
export class FlashGovernor {
  readonly #maxHighContrastFlashes: number;
  readonly #windowMs: number;
  #acceptedAtMs: number[] = [];
  #lastObservedAtMs = Number.NEGATIVE_INFINITY;
  #mode: FlashMode;

  constructor(options: FlashGovernorOptions = {}) {
    this.#maxHighContrastFlashes =
      options.maxHighContrastFlashes ?? DEFAULT_MAX_FLASHES;
    this.#windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.#mode = options.mode ?? "normal";

    if (!Number.isInteger(this.#maxHighContrastFlashes) || this.#maxHighContrastFlashes < 0) {
      throw new RangeError("maxHighContrastFlashes must be a non-negative integer");
    }

    if (!Number.isFinite(this.#windowMs) || this.#windowMs <= 0) {
      throw new RangeError("windowMs must be a positive finite number");
    }
  }

  get mode(): FlashMode {
    return this.#mode;
  }

  setMode(mode: FlashMode): void {
    this.#mode = mode;
  }

  reset(): void {
    this.#acceptedAtMs = [];
    this.#lastObservedAtMs = Number.NEGATIVE_INFINITY;
  }

  request(request: FlashRequest): FlashDecision {
    if (!Number.isFinite(request.atMs) || request.atMs < 0) {
      throw new RangeError("atMs must be a non-negative finite number");
    }

    // A presentation clock may restart after a scene replacement. Treat that
    // as a new budget instead of retaining timestamps from a future scene.
    if (request.atMs < this.#lastObservedAtMs) {
      this.#acceptedAtMs = [];
    }
    this.#lastObservedAtMs = request.atMs;

    if (request.saturatedRed) {
      return { kind: "fallback", cueId: request.cueId, reason: "saturated_red" };
    }

    if (this.#mode === "off") {
      return { kind: "fallback", cueId: request.cueId, reason: "disabled" };
    }

    if (this.#mode === "reduced") {
      return { kind: "fallback", cueId: request.cueId, reason: "reduced_motion" };
    }

    if (!request.highContrast) {
      return { kind: "render", cueId: request.cueId };
    }

    const inclusiveCutoff = request.atMs - this.#windowMs;
    this.#acceptedAtMs = this.#acceptedAtMs.filter(
      (acceptedAtMs) => acceptedAtMs > inclusiveCutoff,
    );

    if (this.#acceptedAtMs.length >= this.#maxHighContrastFlashes) {
      return { kind: "fallback", cueId: request.cueId, reason: "rate_limited" };
    }

    this.#acceptedAtMs.push(request.atMs);
    return { kind: "render", cueId: request.cueId };
  }
}
