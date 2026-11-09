import type { Payload, PayloadIssue } from '../types';

export function encodeText(
  payload: Extract<Payload, { kind: 'text' }>,
): string {
  return payload.text;
}

export function validateText(
  payload: Extract<Payload, { kind: 'text' }>,
): PayloadIssue[] {
  return payload.text.trim()
    ? []
    : [{ field: 'text', message: 'Enter text or a URL.' }];
}
