import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { defaultDesign, useAppStore } from './store';
import { createEmptyPayload } from '../core/payloads';
import { downloadFilename } from './PreviewCard';
import { readLogo } from './DesignPanels';

beforeEach(() => {
  useAppStore.setState({
    activeKind: 'text',
    mode: 'Single',
    design: defaultDesign(),
    exportOptions: { format: 'png', sizePx: 1024 },
    payloads: {
      text: { kind: 'text', text: 'https://example.com' },
      wifi: createEmptyPayload('wifi'),
      contact: createEmptyPayload('contact'),
      email: createEmptyPayload('email'),
      phone: createEmptyPayload('phone'),
      sms: createEmptyPayload('sms'),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps separate drafts when switching content kinds', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Text or URL'), {
    target: { value: 'My draft' },
  });
  fireEvent.click(screen.getByRole('radio', { name: 'Wi-Fi' }));
  fireEvent.change(screen.getByLabelText('Network name'), {
    target: { value: 'Home network' },
  });
  fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
  expect(screen.getByLabelText<HTMLInputElement>('Text or URL').value).toBe(
    'My draft',
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Wi-Fi' }));
  expect(screen.getByLabelText<HTMLInputElement>('Network name').value).toBe(
    'Home network',
  );
});
it('shows field validation only after touch and safely updates the preview', async () => {
  render(<App />);
  const initial = screen.getByRole('img').getAttribute('src');
  const field = screen.getByLabelText('Text or URL');
  fireEvent.change(field, { target: { value: 'Hello' } });
  await waitFor(() =>
    expect(screen.getByRole('img').getAttribute('src')).not.toBe(initial),
  );
  fireEvent.change(field, { target: { value: '' } });
  expect(screen.queryByText('Enter text or a URL.')).toBeNull();
  fireEvent.blur(field);
  expect(screen.getByText('Enter text or a URL.')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('img')).toBeNull());
  expect(
    screen
      .getByRole('button', { name: 'Download PNG' })
      .hasAttribute('disabled'),
  ).toBe(true);
});
it('updates transparency and rejects malformed color text without changing the design', () => {
  render(<App />);
  fireEvent.click(
    screen.getByRole('switch', { name: 'Transparent background' }),
  );
  expect(useAppStore.getState().design.background.transparent).toBe(true);
  fireEvent.change(screen.getByLabelText('Background color'), {
    target: { value: '#zzzzzz' },
  });
  expect(useAppStore.getState().design.background.color).toBe('#ffffff');
  expect(
    screen.getByText('Use a six-digit hex color, such as #112233.'),
  ).toBeTruthy();
});
it('loads a logo locally, computes its aspect ratio and raises ECC', async () => {
  class LoadedImage {
    naturalWidth = 200;
    naturalHeight = 100;
    onload: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', LoadedImage);
  render(<App />);
  fireEvent.change(screen.getByLabelText('Upload logo'), {
    target: { files: [new File(['image'], 'logo.png', { type: 'image/png' })] },
  });
  await waitFor(() =>
    expect(
      screen.getByText('Error correction raised to H for the logo.'),
    ).toBeTruthy(),
  );
  expect(useAppStore.getState().design.errorCorrection).toBe('H');
  expect(useAppStore.getState().design.logo?.aspectRatio).toBe(2);
  expect(useAppStore.getState().design.logo?.src).toMatch(
    /^data:image\/png;base64,/,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
  expect(useAppStore.getState().design.logo).toBeNull();
});
it('rejects unsupported and oversized logo files', async () => {
  await expect(
    readLogo(new File(['text'], 'logo.txt', { type: 'text/plain' })),
  ).rejects.toThrow('Choose a PNG');
  await expect(
    readLogo(
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', {
        type: 'image/png',
      }),
    ),
  ).rejects.toThrow('smaller than 2 MB');
});
it('downloads an SVG with the content kind, timestamp and extension', async () => {
  const create = vi.fn(() => 'blob:download');
  Object.defineProperty(URL, 'createObjectURL', {
    value: create,
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: 'svg' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  const anchor = click.mock.instances[0];
  expect((anchor as HTMLAnchorElement).download).toMatch(
    /^qr-text-\d{8}-\d{6}\.svg$/,
  );
  expect(create.mock.calls[0]).toBeTruthy();
  expect(downloadFilename('wifi', 'png', new Date(2026, 0, 2, 3, 4, 5))).toBe(
    'qr-wifi-20260102-030405.png',
  );
});
it('opens bulk tools and returns to the single editor', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: 'Bulk' }));
  await screen.findByText('0 codes, 0 errors');
  fireEvent.click(screen.getByRole('button', { name: 'Edit design' }));
  expect(screen.getByLabelText('Text or URL')).toBeTruthy();
});
