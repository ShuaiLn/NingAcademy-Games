"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface CompositionSafeAnswerProps {
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  readonly id: string;
  readonly onSubmit: (answer: string) => void;
  readonly placeholder?: string;
  readonly submitLabel?: string;
}

/**
 * Prevents Enter from submitting while a Chinese/Japanese/Korean IME is still
 * composing. Pointer lock must be released by the owning question overlay.
 */
export function CompositionSafeAnswer({
  autoFocus = false,
  disabled = false,
  id,
  onSubmit,
  placeholder,
  submitLabel = "提交 / Submit",
}: CompositionSafeAnswerProps): React.JSX.Element {
  const composingRef = useRef(false);
  const [answer, setAnswer] = useState("");

  const submit = (): void => {
    const normalized = answer.trim();
    if (!disabled && normalized.length > 0 && !composingRef.current) {
      onSubmit(normalized);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // `isComposing` is authoritative where supported; keyCode 229 covers old
    // Chromium IME paths used by some managed school devices.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="answer-form" onSubmit={handleSubmit}>
      <label htmlFor={id}>键盘作答 / Type your answer</label>
      <div>
        <input
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          id={id}
          onChange={(event) => setAnswer(event.currentTarget.value)}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          value={answer}
        />
        <button disabled={disabled || answer.trim().length === 0} type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
