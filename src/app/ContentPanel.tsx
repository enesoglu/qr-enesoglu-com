import { useState } from 'react';
import { validatePayload } from '../core/payloads';
import { kindLabels, kinds, useAppStore } from './store';
import { RadioGroup } from '../components/Controls';

const labels: Record<string, string> = {
  text: 'Text or URL',
  ssid: 'Network name',
  password: 'Password',
  firstName: 'First name',
  lastName: 'Last name',
  organization: 'Organization',
  title: 'Job title',
  phone: 'Phone number',
  email: 'Email address',
  website: 'Website',
  address: 'Address',
  note: 'Note',
  to: 'Recipient email',
  subject: 'Subject',
  body: 'Message',
  number: 'Phone number',
  message: 'Message',
};
const autocomplete: Record<string, string> = {
  firstName: 'given-name',
  lastName: 'family-name',
  organization: 'organization',
  title: 'organization-title',
  phone: 'tel',
  number: 'tel',
  email: 'email',
  to: 'email',
  website: 'url',
  address: 'street-address',
};
export function ContentPanel() {
  const { activeKind, payloads, setKind, updatePayload } = useAppStore();
  const payload = payloads[activeKind];
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  let issues: { field: string; message: string }[] = [];
  try {
    issues = validatePayload(payload);
  } catch {
    /* Encoding status explains unavailable core features. */
  }
  return (
    <section className="panel">
      <h2>Content</h2>
      <RadioGroup
        label="Content type"
        value={kindLabels[activeKind]}
        options={kinds.map((kind) => kindLabels[kind])}
        onChange={(label) => {
          const kind = kinds.find((kind) => kindLabels[kind] === label);
          if (kind) setKind(kind);
        }}
      />
      <div className="fields">
        {Object.entries(payload)
          .filter(([field]) => field !== 'kind')
          .map(([field, value]) => {
            const id = `content-${activeKind}-${field}`;
            const error = touched[id]
              ? issues.find((issue) => issue.field === field)?.message
              : undefined;
            if (field === 'hidden')
              return (
                <label key={id} className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) =>
                      updatePayload(field, event.target.checked)
                    }
                  />
                  Hidden network
                </label>
              );
            if (field === 'encryption')
              return (
                <label className="field" key={id}>
                  Security
                  <select
                    value={String(value)}
                    onChange={(event) =>
                      updatePayload(field, event.target.value)
                    }
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">No password</option>
                  </select>
                </label>
              );
            const shared = {
              id,
              value: String(value),
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => updatePayload(field, event.target.value),
              onBlur: () =>
                setTouched((current) => ({ ...current, [id]: true })),
              'aria-invalid': !!error,
              'aria-describedby': error ? `${id}-error` : undefined,
              autoComplete: autocomplete[field] ?? 'off',
            };
            return (
              <div className="field" key={id}>
                <label htmlFor={id}>{labels[field] ?? field}</label>
                {['text', 'body', 'message', 'note', 'address'].includes(
                  field,
                ) ? (
                  <textarea {...shared} rows={field === 'text' ? 4 : 2} />
                ) : (
                  <input
                    {...shared}
                    type={
                      field === 'password'
                        ? 'password'
                        : ['email', 'to'].includes(field)
                          ? 'email'
                          : ['number', 'phone'].includes(field)
                            ? 'tel'
                            : field === 'website'
                              ? 'url'
                              : 'text'
                    }
                    disabled={
                      field === 'password' &&
                      payload.kind === 'wifi' &&
                      payload.encryption === 'nopass'
                    }
                  />
                )}
                {error && (
                  <small id={`${id}-error`} role="status">
                    {error}
                  </small>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
