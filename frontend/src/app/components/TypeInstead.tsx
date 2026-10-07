import { useState, type FormEvent } from "react";
import { icons } from "../icons";

/**
 * The way forward on a speaking card when the microphone can't be used: a link,
 * "Can't speak right now? Type it instead", that opens a box for typing the answer.
 * Every speaking card offers the same, and only when speaking isn't possible.
 */
export function TypeInstead({ id, languageCode, onSubmit, disabled = false, placeholder = "Type it in French…", open: startOpen = false }: {
  id: string;
  /** Already chosen, on an earlier line: the box shows straight away. */
  open?: boolean;
  languageCode: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState("");
  if (!open) {
    return <button className="text-button" onClick={() => setOpen(true)}>Can't speak right now? Type it instead</button>;
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSubmit(text.trim());
    setText("");
  };
  return (
    <form className="say-form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor={`type-${id}`}>Type your answer in French</label>
      <input
        id={`type-${id}`}
        className="text-field"
        type="text"
        lang={languageCode}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        maxLength={120}
        autoComplete="off"
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        autoFocus
      />
      <button className="round-button send" type="submit" disabled={!text.trim() || disabled} aria-label="Say it">
        <img src={icons.next} alt="" />
      </button>
    </form>
  );
}
