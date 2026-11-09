import { useState } from 'react';
import { DEFAULT_DESIGN } from '../core/defaults';
import { encodePayload } from '../core/payloads';
import { renderSvg } from '../core/render';

export function App() {
  const [text, setText] = useState('https://example.com');
  let svg = '';
  let error = '';
  if (text) {
    try {
      svg = renderSvg(encodePayload({ kind: 'text', text }), DEFAULT_DESIGN, {
        sizePx: 288,
      });
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : 'Unable to generate a QR code.';
    }
  }
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">QR Generator</h1>
      <label className="block" htmlFor="content">
        Text or URL
      </label>
      <textarea
        id="content"
        className="block w-full border p-2"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      {svg ? (
        <img
          alt="QR code preview"
          width={288}
          height={288}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        />
      ) : (
        !error && <p>Enter text to generate a QR code.</p>
      )}
    </main>
  );
}
