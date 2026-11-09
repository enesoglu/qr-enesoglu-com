import type { Payload, PayloadIssue } from '../types';
import { isEmail, isWebsite } from './validation';

type ContactPayload = Extract<Payload, { kind: 'contact' }>;

function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[,;]/g, (character) => `\\${character}`);
}

export function encodeContact(payload: ContactPayload): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(payload.lastName)};${escapeVcard(payload.firstName)};;;`,
    `FN:${escapeVcard([payload.firstName, payload.lastName].filter(Boolean).join(' '))}`,
  ];
  const fields = [
    ['ORG', payload.organization],
    ['TITLE', payload.title],
    ['TEL;TYPE=CELL', payload.phone],
    ['EMAIL', payload.email],
    ['URL', payload.website],
  ];
  for (const [name, value] of fields) {
    if (value) lines.push(`${name}:${escapeVcard(value)}`);
  }
  if (payload.address)
    lines.push(`ADR;TYPE=WORK:;;${escapeVcard(payload.address)};;;;`);
  if (payload.note) lines.push(`NOTE:${escapeVcard(payload.note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function validateContact(payload: ContactPayload): PayloadIssue[] {
  const issues: PayloadIssue[] = [];
  if (!payload.firstName.trim() && !payload.lastName.trim())
    issues.push({ field: 'firstName', message: 'A name is required' });
  if (payload.email && !isEmail(payload.email))
    issues.push({ field: 'email', message: 'Enter a valid email address' });
  if (payload.website && !isWebsite(payload.website))
    issues.push({ field: 'website', message: 'Enter a valid website URL' });
  return issues;
}
