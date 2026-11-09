import type { Payload, PayloadIssue } from '../types';

type SmsPayload = Extract<Payload, { kind: 'sms' }>;

export function encodeSms(payload: SmsPayload): string {
  return `SMSTO:${payload.number}:${payload.message}`;
}

export function validateSms(payload: SmsPayload): PayloadIssue[] {
  return payload.number.trim()
    ? []
    : [{ field: 'number', message: 'Phone number is required' }];
}
