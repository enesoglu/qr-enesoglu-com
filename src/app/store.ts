import { create } from 'zustand';
import {
  createEmptyPayload,
  encodePayload,
  validatePayload,
} from '../core/payloads';
import { QrDataTooLongError, renderSvg } from '../core/render';
import type {
  Payload,
  PayloadKind,
  QrDesign,
  LogoOptions,
} from '../core/types';

export const kinds: PayloadKind[] = [
  'text',
  'wifi',
  'contact',
  'email',
  'phone',
  'sms',
];
export const kindLabels = {
  text: 'Text',
  wifi: 'Wi-Fi',
  contact: 'Contact',
  email: 'Email',
  phone: 'Phone',
  sms: 'SMS',
};
export function defaultDesign(): QrDesign {
  return {
    errorCorrection: 'M',
    margin: 4,
    body: { shape: 'square', fill: { type: 'solid', color: '#000000' } },
    cornerFrame: { shape: 'square', color: null },
    cornerDot: { shape: 'square', color: null },
    background: { color: '#ffffff', transparent: false },
    logo: null,
  };
}
interface AppState {
  payloads: Record<PayloadKind, Payload>;
  activeKind: PayloadKind;
  design: QrDesign;
  exportOptions: { format: 'png' | 'svg'; sizePx: number };
  mode: 'Single' | 'Bulk';
  setKind: (kind: PayloadKind) => void;
  updatePayload: (field: string, value: string | boolean) => void;
  setDesign: (design: QrDesign) => void;
  setExport: (options: Partial<AppState['exportOptions']>) => void;
  setMode: (mode: AppState['mode']) => void;
  setLogo: (logo: LogoOptions | null) => boolean;
  resetDesign: () => void;
}
export const useAppStore = create<AppState>((set) => ({
  payloads: {
    text: { kind: 'text', text: 'https://example.com' },
    wifi: createEmptyPayload('wifi'),
    contact: createEmptyPayload('contact'),
    email: createEmptyPayload('email'),
    phone: createEmptyPayload('phone'),
    sms: createEmptyPayload('sms'),
  },
  activeKind: 'text',
  design: defaultDesign(),
  exportOptions: { format: 'png', sizePx: 1024 },
  mode: 'Single',
  setKind: (activeKind) => set({ activeKind }),
  updatePayload: (field, value) =>
    set((state) => ({
      payloads: {
        ...state.payloads,
        [state.activeKind]: {
          ...state.payloads[state.activeKind],
          [field]: value,
        },
      },
    })),
  setDesign: (design) => set({ design }),
  setExport: (options) =>
    set((state) => ({ exportOptions: { ...state.exportOptions, ...options } })),
  setMode: (mode) => set({ mode }),
  setLogo: (logo) => {
    let raised = false;
    set((state) => {
      raised = !!logo && ['L', 'M'].includes(state.design.errorCorrection);
      return {
        design: {
          ...state.design,
          logo,
          errorCorrection: raised ? 'H' : state.design.errorCorrection,
        },
      };
    });
    return raised;
  },
  resetDesign: () => set({ design: defaultDesign() }),
}));
export function errorMessage(error: unknown): string {
  if (error instanceof QrDataTooLongError)
    return 'Content is too long. Shorten it or choose a lower error correction level.';
  return error instanceof Error
    ? error.message
    : 'Unable to generate a QR code.';
}
export function encodedData(state: Pick<AppState, 'payloads' | 'activeKind'>) {
  try {
    const payload = state.payloads[state.activeKind];
    const issues = validatePayload(payload);
    return {
      data: issues.length ? '' : encodePayload(payload),
      error: issues.length
        ? 'Complete the content fields to generate a QR code.'
        : '',
    };
  } catch (error) {
    return { data: '', error: errorMessage(error) };
  }
}
export function previewSvg(
  state: Pick<AppState, 'payloads' | 'activeKind' | 'design'>,
) {
  const encoded = encodedData(state);
  if (!encoded.data) return { svg: '', error: encoded.error };
  try {
    return {
      svg: renderSvg(encoded.data, state.design, { sizePx: 320 }),
      error: '',
    };
  } catch (error) {
    return { svg: '', error: errorMessage(error) };
  }
}
