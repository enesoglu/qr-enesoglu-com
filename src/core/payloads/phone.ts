import type { Payload, PayloadIssue } from '../types';

type PhonePayload = Extract<Payload, { kind: 'phone' }>;

export function encodePhone(payload: PhonePayload): string {
  return `tel:${payload.number.replace(/[\s()-]/g, '')}`;
}

export function validatePhone(payload: PhonePayload): PayloadIssue[] {
  return /\d/.test(payload.number)
    ? []
    : [{ field: 'number', message: 'Enter a phone number' }];
}
