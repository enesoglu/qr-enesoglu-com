import { useId, useState } from 'react';

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="segments">
        {options.map((option) => (
          <label key={option} className={option === value ? 'selected' : ''}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const invalid = !/^#[\da-f]{6}$/i.test(text);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="color-input">
        <input
          aria-label={`${label} picker`}
          type="color"
          value={value}
          onChange={(event) => {
            setDraft(null);
            onChange(event.target.value);
          }}
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          maxLength={7}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (/^#[\da-f]{6}$/i.test(next)) {
              onChange(next);
              setDraft(null);
            }
          }}
        />
      </div>
      {invalid && (
        <small id={`${id}-error`} role="status">
          Use a six-digit hex color, such as #112233.
        </small>
      )}
    </div>
  );
}
export function ShapePicker<T extends string>({
  label,
  value,
  options,
  onChange,
  thumbnail,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (shape: T) => void;
  thumbnail: (shape: T, idPrefix: string) => string;
}) {
  const name = useId();
  return (
    <fieldset className="shape-picker">
      <legend>{label}</legend>
      <div>
        {options.map((shape) => (
          <label key={shape} className={value === shape ? 'selected' : ''}>
            <input
              type="radio"
              name={name}
              checked={value === shape}
              onChange={() => onChange(shape)}
            />
            <img
              alt=""
              aria-hidden="true"
              width="30"
              height="30"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnail(shape, `shape-${name.replace(/[^a-zA-Z0-9_-]/g, '')}-${shape}`))}`}
            />
            <span>{shape}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
