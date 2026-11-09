import type { Payload, PayloadIssue, PayloadKind } from '../types';
import { encodeText, validateText } from './text';
import { encodeWifi, validateWifi } from './wifi';
import { encodeContact, validateContact } from './contact';
import { encodeEmail, validateEmail } from './email';
import { encodePhone, validatePhone } from './phone';
import { encodeSms, validateSms } from './sms';

export function encodePayload(payload: Payload): string {
  switch (payload.kind) {
    case 'text':
      return encodeText(payload);
    case 'wifi':
      return encodeWifi(payload);
    case 'contact':
      return encodeContact(payload);
    case 'email':
      return encodeEmail(payload);
    case 'phone':
      return encodePhone(payload);
    case 'sms':
      return encodeSms(payload);
  }
}

export function validatePayload(payload: Payload): PayloadIssue[] {
  switch (payload.kind) {
    case 'text':
      return validateText(payload);
    case 'wifi':
      return validateWifi(payload);
    case 'contact':
      return validateContact(payload);
    case 'email':
      return validateEmail(payload);
    case 'phone':
      return validatePhone(payload);
    case 'sms':
      return validateSms(payload);
  }
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
