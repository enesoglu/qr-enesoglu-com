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
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (shape: T) => void;
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
            <svg aria-hidden="true" viewBox="0 0 32 32" width="30" height="30">
              {shape === 'dot' || shape === 'circle' ? (
                <circle cx="16" cy="16" r="11" />
              ) : shape === 'diamond' ? (
                <path d="M16 3 29 16 16 29 3 16Z" />
              ) : shape === 'fluid' ? (
                <path d="M5 5h10v6h12v16H5Z" />
              ) : (
                <rect
                  x="5"
                  y="5"
                  width="22"
                  height="22"
                  rx={shape === 'rounded' ? 7 : 0}
                />
              )}
            </svg>
            <span>{shape}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
