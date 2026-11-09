import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createAppStore, defaultDesign } from './store';
import { maxStoredLogoBytes, preferencesKey } from './preferences';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('rehydrates design and export settings without saving payload contents or bulk rows', () => {
  const store = createAppStore();
  const state = store.getState();
  state.setKind('wifi');
  store.getState().updatePayload('ssid', 'private-network');
  store.getState().updatePayload('password', 'private-password');
  store.getState().setBulkInput('private-bulk-row');
  state.setDesign({
    ...defaultDesign(),
    body: { shape: 'rounded', fill: { type: 'solid', color: '#153b65' } },
  });
  state.setExport({ format: 'svg', sizePx: 2048 });
  const raw = localStorage.getItem(preferencesKey)!;
  for (const secret of [
    'private-network',
    'private-password',
    'private-bulk-row',
    'payloads',
    'bulkInput',
  ])
    expect(raw).not.toContain(secret);
  const restored = createAppStore().getState();
  expect(restored.design.body.shape).toBe('rounded');
  expect(restored.exportOptions).toEqual({ format: 'svg', sizePx: 2048 });
  expect(restored.activeKind).toBe('wifi');
  expect(restored.payloads.wifi).toMatchObject({ ssid: '', password: '' });
  expect(restored.bulkInput).toBe('');
});
it('migrates an older version and strips unrecognized fields on hydration', () => {
  localStorage.setItem(
    preferencesKey,
    JSON.stringify({
      version: 0,
      state: {
        activeKind: 'phone',
        design: { ...defaultDesign(), margin: 7, secret: 'do-not-store' },
        exportOptions: { format: 'svg', sizePx: 512 },
        payloads: { phone: { number: 'do-not-store' } },
      },
    }),
  );
  const store = createAppStore();
  expect(store.getState().design.margin).toBe(7);
  expect(store.getState().activeKind).toBe('phone');
  expect(store.getState().payloads.phone).toMatchObject({ number: '' });
  const saved = localStorage.getItem(preferencesKey)!;
  expect(JSON.parse(saved).version).toBe(1);
  expect(saved).not.toContain('do-not-store');
});
it('omits logos larger than 500 KB without removing the live logo', () => {
  const store = createAppStore();
  const logo = {
    src: 'data:image/png;base64,' + 'a'.repeat(maxStoredLogoBytes),
    aspectRatio: 1,
    size: 0.2,
    padding: 1,
    clearModules: true,
  };
  store.getState().setLogo(logo);
  expect(store.getState().design.logo).toEqual(logo);
  expect(
    JSON.parse(localStorage.getItem(preferencesKey)!).state.design.logo,
  ).toBeNull();
  expect(createAppStore().getState().design.logo).toBeNull();
  const small = { ...logo, src: 'data:image/png;base64,AAAA' };
  store.getState().setLogo(small);
  expect(createAppStore().getState().design.logo).toEqual(small);
});
it('reset removes the saved design while retaining other preferences', () => {
  const store = createAppStore();
  store.getState().setDesign({ ...defaultDesign(), margin: 8 });
  store.getState().setExport({ format: 'svg' });
  store.getState().setKind('sms');
  store.getState().resetDesign();
  expect(
    JSON.parse(localStorage.getItem(preferencesKey)!).state.design,
  ).toBeUndefined();
  const restored = createAppStore().getState();
  expect(restored.design).toEqual(defaultDesign());
  expect(restored.exportOptions.format).toBe('svg');
  expect(restored.activeKind).toBe('sms');
});
it('recovers from malformed storage and validates invalid stored preferences', () => {
  localStorage.setItem(preferencesKey, '{broken JSON');
  expect(createAppStore().getState().design).toEqual(defaultDesign());
  localStorage.setItem(
    preferencesKey,
    JSON.stringify({
      version: 1,
      state: {
        activeKind: 'unknown',
        design: {
          body: {
            shape: 'invalid',
            fill: { type: 'linear', stops: [null, null] },
          },
          logo: { src: 'https://example.org/logo.png' },
          margin: -5,
        },
        exportOptions: { format: 'zip', sizePx: -1 },
        payloads: {},
      },
    }),
  );
  const state = createAppStore().getState();
  expect(state.activeKind).toBe('text');
  expect(state.design.body.shape).toBe('square');
  expect(state.design.margin).toBe(4);
  expect(state.design.logo).toBeNull();
  expect(state.exportOptions).toEqual({ format: 'png', sizePx: 1024 });
});
it('falls back safely for unknown future versions and unavailable storage', () => {
  localStorage.setItem(
    preferencesKey,
    JSON.stringify({
      version: 99,
      state: { design: { ...defaultDesign(), margin: 9 } },
    }),
  );
  expect(createAppStore().getState().design).toEqual(defaultDesign());
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  const store = createAppStore();
  expect(() =>
    store.getState().setDesign({ ...defaultDesign(), margin: 6 }),
  ).not.toThrow();
  expect(store.getState().design.margin).toBe(6);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(() => createAppStore()).not.toThrow();
});
