import type { Payload, PayloadIssue } from '../types';

type WifiPayload = Extract<Payload, { kind: 'wifi' }>;

function escapeWifi(value: string): string {
  return value.replace(/[\\;,:"]/g, (character) => `\\${character}`);
}

export function encodeWifi(payload: WifiPayload): string {
  const fields = [`T:${payload.encryption}`, `S:${escapeWifi(payload.ssid)}`];
  if (payload.encryption !== 'nopass')
    fields.push(`P:${escapeWifi(payload.password)}`);
  if (payload.hidden) fields.push('H:true');
  return `WIFI:${fields.join(';')};;`;
}

export function validateWifi(payload: WifiPayload): PayloadIssue[] {
  const issues: PayloadIssue[] = [];
  if (!payload.ssid.trim())
    issues.push({ field: 'ssid', message: 'Network name is required' });
  if (payload.encryption !== 'nopass' && !payload.password) {
    issues.push({ field: 'password', message: 'Password is required' });
  }
  return issues;
}
