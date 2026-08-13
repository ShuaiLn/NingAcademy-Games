"use client";

import { CompositionSafeAnswer } from "./composition-safe-answer";
import type { PracticeQuestionFeedback, PublicPracticeQuestion } from "@/practice/types";

export interface PracticeQuestionOverlayProps {
  readonly feedback: PracticeQuestionFeedback | null;
  readonly onContinue: () => void;
  readonly onSubmit: (answer: string) => void;
  readonly progressLabel: string;
  readonly question: PublicPracticeQuestion;
  readonly remainingMs?: number;
  readonly title: string;
}

export function PracticeQuestionOverlay({
  feedback,
  onContinue,
  onSubmit,
  progressLabel,
  question,
  remainingMs,
  title,
}: PracticeQuestionOverlayProps): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby={`${question.id}-title`}
        aria-modal="true"
        className="question-panel"
        role="dialog"
      >
        <div className="question-meta">
          <span>{progressLabel}</span>
          {remainingMs === undefined ? (
            <strong>无时限 / Untimed</strong>
          ) : (
            <strong className={remainingMs <= 5_000 ? "timer-danger" : ""}>
              {(remainingMs / 1_000).toFixed(1)}s
            </strong>
          )}
        </div>
        <p className="mock-label">{question.sourceLabel}</p>
        <h2 id={`${question.id}-title`}>{title}</h2>
        <p className="question-prompt">{question.prompt}</p>

        {feedback === null ? (
          <CompositionSafeAnswer
            autoFocus
            id={`${question.id}-answer`}
            key={question.id}
            onSubmit={onSubmit}
            placeholder="输入答案 / Type answer"
          />
        ) : (
          <div aria-live="assertive" className={`answer-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`}>
            <strong>
              {feedback.correct
                ? "回答正确 / Correct"
                : feedback.timedOut
                  ? "时间到 / Time expired"
                  : "回答错误 / Incorrect"}
            </strong>
            {!feedback.correct && <p>正确答案：{feedback.correctAnswer}</p>}
            <p>{feedback.explanation}</p>
            <button onClick={onContinue} type="button">继续 / Continue</button>
          </div>
        )}

        <p className="security-note">
          本题仅用于本地流程测试；答案存在客户端。正式模式必须由 RemoteAuthority 服务端判定。
        </p>
      </section>
    </div>
  );
}
