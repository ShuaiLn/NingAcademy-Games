import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  decodeSubmitAnswerMessage,
  type QuestionPresentedMessage,
} from "../src/index.js";

describe("learning protocol", () => {
  it("presents a frozen question without its answer", () => {
    const question: QuestionPresentedMessage = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "learning.question.presented",
      questionInstanceId: "question-1",
      questionPurpose: "card",
      questionTier: 3,
      questionType: "en_to_zh",
      prompt: {
        kind: "translation",
        sourceLanguage: "en",
        sourceText: "crystal",
        targetLanguage: "zh",
      },
      timeLimitMs: 20_000,
      expiresAtServerMs: 50_000,
    };

    expect(question).not.toHaveProperty("correctAnswer");
    expect(JSON.stringify(question)).not.toContain("水晶");
  });

  it("accepts an identity-free idempotent answer submission", () => {
    const submission = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "learning.answer.submit",
      requestId: "answer-request-1",
      questionInstanceId: "question-1",
      submittedAtClientMs: 12_000,
      answerText: "水晶",
      answerMode: "standard",
    };

    expect(decodeSubmitAnswerMessage(submission)).toEqual({
      ok: true,
      value: submission,
    });
  });

  it("rejects client-smuggled identity and grading fields", () => {
    const unsafeSubmission = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "learning.answer.submit",
      requestId: "answer-request-1",
      questionInstanceId: "question-1",
      submittedAtClientMs: 12_000,
      answerText: "水晶",
      answerMode: "standard",
      userId: "forged-user",
      correct: true,
    };

    expect(decodeSubmitAnswerMessage(unsafeSubmission)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ENVELOPE" },
    });
  });

  it("marks text alternatives explicitly instead of counting them as listening", () => {
    const submission = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "learning.answer.submit",
      requestId: "answer-request-2",
      questionInstanceId: "question-listening-1",
      submittedAtClientMs: 14_000,
      answerText: "crystal",
      answerMode: "text_alternative",
    };

    expect(decodeSubmitAnswerMessage(submission)).toMatchObject({
      ok: true,
      value: { answerMode: "text_alternative" },
    });
  });
});
