import { describe, expect, it } from 'vitest';
import type { Payload, PayloadKind } from '../types';
import { createEmptyPayload, encodePayload, validatePayload } from './index';

const contact: Extract<Payload, { kind: 'contact' }> = {
  kind: 'contact',
  firstName: 'Çağrı',
  lastName: 'Yıldız',
  organization: '',
  title: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  note: '',
};

describe('payload encoding', () => {
  it('preserves text, including Turkish characters', () => {
    expect(encodePayload({ kind: 'text', text: 'İstanbul\n  Şişli' })).toBe(
      'İstanbul\n  Şişli',
    );
  });

  it.each(['WPA', 'WEP'] as const)(
    'escapes %s Wi-Fi credentials',
    (encryption) => {
      expect(
        encodePayload({
          kind: 'wifi',
          encryption,
          ssid: 'İş;"A",B:C\\D',
          password: 'p;"a",s:s\\',
          hidden: true,
        }),
      ).toBe(
        `WIFI:T:${encryption};S:İş\\;\\"A\\"\\,B\\:C\\\\D;P:p\\;\\"a\\"\\,s\\:s\\\\;H:true;;`,
      );
    },
  );

  it('omits the password for open Wi-Fi and hidden flag for visible networks', () => {
    expect(
      encodePayload({
        kind: 'wifi',
        encryption: 'nopass',
        ssid: 'Guest',
        password: 'ignored',
        hidden: false,
      }),
    ).toBe('WIFI:T:nopass;S:Guest;;');
  });

  it('omits optional contact fields and uses CRLF', () => {
    expect(encodePayload(contact)).toBe(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Yıldız;Çağrı;;;\r\nFN:Çağrı Yıldız\r\nEND:VCARD',
    );
  });

  it('escapes all contact values and includes optional fields in order', () => {
    expect(
      encodePayload({
        ...contact,
        firstName: 'A;B',
        lastName: 'C,D',
        organization: 'Org\\Inc',
        title: 'Dev',
        phone: '+90',
        email: 'a@example.com',
        website: 'https://example.com',
        address: 'A,B\r\nC;D',
        note: 'one\rtwo\nthree',
      }),
    ).toBe(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:C\\,D;A\\;B;;;',
        'FN:A\\;B C\\,D',
        'ORG:Org\\\\Inc',
        'TITLE:Dev',
        'TEL;TYPE=CELL:+90',
        'EMAIL:a@example.com',
        'URL:https://example.com',
        'ADR;TYPE=WORK:;;A\\,B\\nC\\;D;;;;',
        'NOTE:one\\ntwo\\nthree',
        'END:VCARD',
      ].join('\r\n'),
    );
  });

  it('encodes email query values and omits empty parameters', () => {
    expect(
      encodePayload({
        kind: 'email',
        to: 'a@example.com',
        subject: 'İş & ?=',
        body: 'Hi\nA+B',
      }),
    ).toBe(
      'mailto:a@example.com?subject=%C4%B0%C5%9F%20%26%20%3F%3D&body=Hi%0AA%2BB',
    );
    expect(
      encodePayload({
        kind: 'email',
        to: 'a@example.com',
        subject: '',
        body: '',
      }),
    ).toBe('mailto:a@example.com');
    expect(
      encodePayload({
        kind: 'email',
        to: 'a@example.com',
        subject: '',
        body: 'Hi',
      }),
    ).toBe('mailto:a@example.com?body=Hi');
  });

  it('normalizes phone formatting and preserves SMS content', () => {
    expect(
      encodePayload({ kind: 'phone', number: '+90 (555) 123-45-67' }),
    ).toBe('tel:+905551234567');
    expect(
      encodePayload({
        kind: 'sms',
        number: '+90555',
        message: 'İş: hello\nnext',
      }),
    ).toBe('SMSTO:+90555:İş: hello\nnext');
  });
});

describe('payload validation and defaults', () => {
  it.each<PayloadKind>(['text', 'wifi', 'contact', 'email', 'phone', 'sms'])(
    'creates an invalid empty %s payload',
    (kind) => {
      const payload = createEmptyPayload(kind);
      expect(payload.kind).toBe(kind);
      expect(validatePayload(payload).length).toBeGreaterThan(0);
      expect(encodePayload(payload)).toEqual(expect.any(String));
    },
  );

  it('requires network names and protected-network passwords', () => {
    expect(
      validatePayload({
        kind: 'wifi',
        ssid: ' ',
        password: '',
        encryption: 'WPA',
        hidden: false,
      }).map((issue) => issue.field),
    ).toEqual(['ssid', 'password']);
    expect(
      validatePayload({
        kind: 'wifi',
        ssid: 'Guest',
        password: '',
        encryption: 'nopass',
        hidden: false,
      }),
    ).toEqual([]);
  });

  it('accepts either contact name and validates optional email and website', () => {
    expect(validatePayload({ ...contact, firstName: '' })).toEqual([]);
    expect(validatePayload({ ...contact, lastName: '' })).toEqual([]);
    expect(
      validatePayload({ ...contact, email: 'bad', website: 'example.com' }).map(
        (issue) => issue.field,
      ),
    ).toEqual(['email', 'website']);
    expect(
      validatePayload({
        ...contact,
        email: 'a+b@example.com',
        website: 'https://example.com/path',
      }),
    ).toEqual([]);
    expect(
      validatePayload({ ...contact, website: 'javascript:alert(1)' }),
    ).toHaveLength(1);
  });

  it.each(['a', 'a@', '@example.com', 'a b@example.com', 'a@example'])(
    'rejects invalid email %s',
    (to) => {
      expect(
        validatePayload({ kind: 'email', to, subject: '', body: '' }),
      ).toHaveLength(1);
    },
  );

  it('validates text, email, phone digits, and SMS recipient', () => {
    expect(validatePayload({ kind: 'text', text: 'Hello' })).toEqual([]);
    expect(
      validatePayload({
        kind: 'email',
        to: 'a@example.com',
        subject: '',
        body: '',
      }),
    ).toEqual([]);
    expect(validatePayload({ kind: 'phone', number: '+()' })).toHaveLength(1);
    expect(validatePayload({ kind: 'phone', number: '+90 (555)' })).toEqual([]);
    expect(
      validatePayload({ kind: 'sms', number: '  ', message: 'Hello' }),
    ).toHaveLength(1);
    expect(
      validatePayload({ kind: 'sms', number: '+90', message: '' }),
    ).toEqual([]);
  });
});
