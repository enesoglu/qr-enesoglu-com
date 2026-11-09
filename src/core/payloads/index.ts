import { NotImplementedError } from '../errors';
import type { Payload, PayloadIssue, PayloadKind } from '../types';

export function encodePayload(payload: Payload): string {
  if (payload.kind === 'text') return payload.text;
  throw new NotImplementedError(`${payload.kind} encoding`);
}

export function validatePayload(payload: Payload): PayloadIssue[] {
  if (payload.kind !== 'text')
    throw new NotImplementedError(`${payload.kind} validation`);
  return payload.text.trim()
    ? []
    : [{ field: 'text', message: 'Enter text or a URL.' }];
}

export function createEmptyPayload(kind: PayloadKind): Payload {
  switch (kind) {
    case 'text':
      return { kind, text: '' };
    case 'wifi':
      return { kind, ssid: '', password: '', encryption: 'WPA', hidden: false };
    case 'contact':
      return {
        kind,
        firstName: '',
        lastName: '',
        organization: '',
        title: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        note: '',
      };
    case 'email':
      return { kind, to: '', subject: '', body: '' };
    case 'phone':
      return { kind, number: '' };
    case 'sms':
      return { kind, number: '', message: '' };
  }
}
