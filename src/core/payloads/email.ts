import type { Payload, PayloadIssue } from '../types';
import { isEmail } from './validation';

type EmailPayload = Extract<Payload, { kind: 'email' }>;

export function encodeEmail(payload: EmailPayload): string {
  const params: string[] = [];
  if (payload.subject)
    params.push(`subject=${encodeURIComponent(payload.subject)}`);
  if (payload.body) params.push(`body=${encodeURIComponent(payload.body)}`);
  return `mailto:${payload.to}${params.length ? `?${params.join('&')}` : ''}`;
}

export function validateEmail(payload: EmailPayload): PayloadIssue[] {
  return isEmail(payload.to)
    ? []
    : [{ field: 'to', message: 'Enter a valid email address' }];
}
