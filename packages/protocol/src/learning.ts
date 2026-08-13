import { PROTOCOL_VERSION, type DecodeResult } from "./envelopes.js";

export type QuestionType =
  | "en_to_zh"
  | "zh_to_en"
  | "listening_spelling"
  | "math";

export type QuestionPurpose = "card" | "rescue" | "role_gate" | "review";
export type AnswerMode = "standard" | "text_alternative";

export type PublicQuestionPrompt =
  | {
      readonly kind: "translation";
      readonly sourceLanguage: "en" | "zh";
      readonly sourceText: string;
      readonly targetLanguage: "en" | "zh";
    }
  | {
      readonly kind: "listening";
      readonly audioAssetId: string;
      readonly textAlternativeAvailable: boolean;
    }
  | {
      readonly kind: "math";
      readonly expression: string;
      readonly inputKind: "number" | "text" | "true_false";
    };

/** Server-to-one-player DTO. Correct answers are structurally absent. */
export interface QuestionPresentedMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "learning.question.presented";
  readonly questionInstanceId: string;
  readonly questionPurpose: QuestionPurpose;
  readonly questionTier: number;
  readonly questionType: QuestionType;
  readonly prompt: PublicQuestionPrompt;
  readonly timeLimitMs: number | null;
  readonly expiresAtServerMs: number | null;
}

export interface SubmitAnswerMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "learning.answer.submit";
  readonly requestId: string;
  readonly questionInstanceId: string;
  readonly submittedAtClientMs: number;
  readonly answerText: string;
  readonly answerMode: AnswerMode;
}

/**
 * Server-to-one-player result, emitted only after the immutable attempt is
 * persisted. It may disclose the answer for feedback and must never broadcast.
 */
export interface AnswerGradedMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "learning.answer.graded";
  readonly requestId: string;
  readonly questionInstanceId: string;
  readonly correct: boolean;
  readonly correctAnswer: string;
  readonly explanation: string;
  readonly countsForAssignment: boolean;
  readonly countsForRank: boolean;
  readonly damageApplied: number;
  readonly remainingHp: number;
  readonly duplicate: boolean;
}

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_ANSWER_LENGTH = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  const keys = Object.keys(value);
  return required.every((key) => key in value) && keys.every((key) => required.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function isClientTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isSubmitAnswerMessage(value: unknown): value is SubmitAnswerMessage {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "protocolVersion",
      "messageType",
      "requestId",
      "questionInstanceId",
      "submittedAtClientMs",
      "answerText",
      "answerMode",
    ])
  ) {
    return false;
  }

  return (
    value.protocolVersion === PROTOCOL_VERSION
    && value.messageType === "learning.answer.submit"
    && isIdentifier(value.requestId)
    && isIdentifier(value.questionInstanceId)
    && isClientTimestamp(value.submittedAtClientMs)
    && typeof value.answerText === "string"
    && value.answerText.trim().length > 0
    && value.answerText.length <= MAX_ANSWER_LENGTH
    && (value.answerMode === "standard" || value.answerMode === "text_alternative")
  );
}

export function decodeSubmitAnswerMessage(value: unknown): DecodeResult<SubmitAnswerMessage> {
  if (isRecord(value) && value.protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_PROTOCOL_VERSION",
        message: `Expected protocol version ${PROTOCOL_VERSION}`,
      },
    };
  }

  if (!isSubmitAnswerMessage(value)) {
    return {
      ok: false,
      error: {
        code: "INVALID_ENVELOPE",
        message: "The learning answer message is malformed",
      },
    };
  }

  return { ok: true, value };
}
