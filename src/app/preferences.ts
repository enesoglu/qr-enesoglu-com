import { DEFAULT_DESIGN } from '../core/defaults';
import type { Fill, LogoOptions, PayloadKind, QrDesign } from '../core/types';
import type { StateStorage } from 'zustand/middleware';

export const preferencesKey = 'qr-enesoglu-com:v1';
export const maxStoredLogoBytes = 500 * 1024;
interface Preferences {
  design: QrDesign;
  exportOptions: { format: 'png' | 'svg'; sizePx: number };
  activeKind: PayloadKind;
}
function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.find((item) => item === value) ?? fallback;
}
function number(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  integer = false,
): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
    ? value
    : fallback;
}
function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
    ? value
    : fallback;
}
function fill(value: unknown): Fill {
  const saved = object(value);
  if (
    (saved.type === 'linear' || saved.type === 'radial') &&
    Array.isArray(saved.stops) &&
    saved.stops.length === 2
  ) {
    const stops: Extract<Fill, { type: 'linear' }>['stops'] = [0, 1].map(
      (index) => {
        const stop = object(
          saved.stops instanceof Array ? saved.stops[index] : undefined,
        );
        return {
          offset: number(stop.offset, 0, 1, index),
          color: color(stop.color, '#000000'),
        };
      },
    ) as Extract<Fill, { type: 'linear' }>['stops'];
    return saved.type === 'linear'
      ? { type: 'linear', rotation: number(saved.rotation, 0, 360, 0), stops }
      : { type: 'radial', stops };
  }
  return { type: 'solid', color: color(saved.color, '#000000') };
}
function logo(value: unknown): LogoOptions | null {
  const saved = object(value);
  if (
    typeof saved.src !== 'string' ||
    !/^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;base64)?,/i.test(saved.src) ||
    new TextEncoder().encode(saved.src).byteLength > maxStoredLogoBytes
  )
    return null;
  return {
    src: saved.src,
    aspectRatio: number(
      saved.aspectRatio,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      1,
    ),
    size: number(saved.size, 0.1, 0.3, 0.2),
    padding: number(saved.padding, 0, 4, 1, true),
    clearModules:
      typeof saved.clearModules === 'boolean' ? saved.clearModules : true,
  };
}
/** Construct a whitelist at every read/write boundary; stored payloads are ignored. */
export function readPreferences(value: unknown): Preferences {
  const saved = object(value),
    design = object(saved.design),
    body = object(design.body),
    frame = object(design.cornerFrame),
    dot = object(design.cornerDot),
    background = object(design.background),
    options = object(saved.exportOptions);
  return {
    activeKind: choice<PayloadKind>(
      saved.activeKind,
      ['text', 'wifi', 'contact', 'email', 'phone', 'sms'],
      'text',
    ),
    exportOptions: {
      format: choice(options.format, ['png', 'svg'], 'png'),
      sizePx: number(options.sizePx, 64, 8192, 1024, true),
    },
    design: {
      errorCorrection: choice(
        design.errorCorrection,
        ['L', 'M', 'Q', 'H'],
        'M',
      ),
      margin: number(design.margin, 0, 10, 4, true),
      body: {
        shape: choice(
          body.shape,
          ['square', 'rounded', 'dot', 'diamond', 'fluid'],
          'square',
        ),
        fill: fill(body.fill),
      },
      cornerFrame: {
        shape: choice(frame.shape, ['square', 'rounded', 'circle'], 'square'),
        color:
          frame.color === null || frame.color === undefined
            ? null
            : color(frame.color, '#000000'),
      },
      cornerDot: {
        shape: choice(
          dot.shape,
          ['square', 'rounded', 'circle', 'diamond'],
          'square',
        ),
        color:
          dot.color === null || dot.color === undefined
            ? null
            : color(dot.color, '#000000'),
      },
      background: {
        color: color(background.color, '#ffffff'),
        transparent: background.transparent === true,
      },
      logo: logo(design.logo),
    },
  };
}
export function savedPreferences(
  value: Preferences,
): Omit<Preferences, 'design'> & { design?: QrDesign } {
  const saved = readPreferences(value);
  // Omit the default design so Reset design removes the stored customization.
  return {
    ...saved,
    design:
      JSON.stringify(saved.design) === JSON.stringify(DEFAULT_DESIGN)
        ? undefined
        : saved.design,
  };
}
export function migratePreferences(value: unknown, version: number) {
  return savedPreferences(readPreferences(version > 1 ? undefined : value));
}
/** Storage denial, malformed JSON and quota exhaustion must not interrupt editing. */
export const preferencesStorage: StateStorage = {
  getItem: (key) => {
    try {
      const value = localStorage.getItem(key);
      if (value) JSON.parse(value);
      return value;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep preferences in memory when storage is unavailable. */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
  },
};
