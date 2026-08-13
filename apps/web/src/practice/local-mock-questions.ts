import type { PublicPracticeQuestion } from "./types";

export const LOCAL_MOCK_SECURITY_NOTICE =
  "UNVERIFIED LOCAL MOCK: answers ship in the browser bundle and must never be used for production grading.";

export interface LocalMockQuestion {
  readonly acceptedAnswers: readonly string[];
  readonly correctAnswer: string;
  readonly explanation: string;
  readonly publicQuestion: PublicPracticeQuestion;
}

const question = (
  id: string,
  prompt: string,
  promptLanguage: PublicPracticeQuestion["promptLanguage"],
  correctAnswer: string,
  acceptedAnswers: readonly string[],
  explanation: string,
): LocalMockQuestion => ({
  acceptedAnswers,
  correctAnswer,
  explanation,
  publicQuestion: {
    id,
    prompt,
    promptLanguage,
    security: "local_mock_answer_embedded_in_client",
    sourceLabel: "UNVERIFIED LOCAL MOCK",
  },
});

/**
 * This bank exists only to exercise UI and local reducer behavior. Production
 * questions must arrive without answers and be judged by RemoteAuthority.
 */
export const LOCAL_ROLE_GATE_QUESTIONS = [
  question("local-role-apple", "Translate ‘apple’ into Chinese.", "en", "苹果", ["苹果"], "apple 的中文是“苹果”。"),
  question("local-role-sum", "7 + 5 = ?", "math", "12", ["12", "十二"], "7 加 5 等于 12。"),
  question("local-role-cold", "Write the opposite of ‘hot’.", "en", "cold", ["cold"], "The opposite of hot is cold."),
  question("local-role-book", "Translate ‘书’ into English.", "zh", "book", ["book"], "“书”的英文是 book。"),
  question("local-role-product", "9 × 3 = ?", "math", "27", ["27", "二十七"], "9 乘 3 等于 27。"),
] as const satisfies readonly LocalMockQuestion[];

export const LOCAL_CARD_QUESTION = question(
  "local-card-product",
  "6 × 7 = ?",
  "math",
  "42",
  ["42", "四十二"],
  "6 乘 7 等于 42。",
);

export function normalizeLocalAnswer(answer: string): string {
  return answer.normalize("NFKC").trim().toLocaleLowerCase("en-US").replaceAll(/\s+/g, " ");
}

export function judgeLocalMockQuestion(
  mock: LocalMockQuestion,
  answer: string,
  timedOut = false,
): { readonly correct: boolean; readonly correctAnswer: string; readonly explanation: string; readonly timedOut: boolean } {
  const normalized = normalizeLocalAnswer(answer);
  return {
    correct: !timedOut && mock.acceptedAnswers.some(
      (candidate) => normalizeLocalAnswer(candidate) === normalized,
    ),
    correctAnswer: mock.correctAnswer,
    explanation: mock.explanation,
    timedOut,
  };
}
