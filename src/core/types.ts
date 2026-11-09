export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type BodyShape = 'square' | 'rounded' | 'dot' | 'diamond' | 'fluid';
export type CornerFrameShape = 'square' | 'rounded' | 'circle';
export type CornerDotShape = 'square' | 'rounded' | 'circle' | 'diamond';

export interface GradientStop {
  offset: number;
  color: string;
} // offset 0..1, color '#rrggbb'
export type Fill =
  | { type: 'solid'; color: string }
  | { type: 'linear'; rotation: number; stops: [GradientStop, GradientStop] } // rotation in degrees
  | { type: 'radial'; stops: [GradientStop, GradientStop] };

export interface LogoOptions {
  src: string; // data: URL (image/png, image/jpeg, image/webp, image/svg+xml)
  aspectRatio: number; // source width / height
  size: number; // logo width as a fraction of the code width (excl. margin), 0.1–0.3
  padding: number; // clear zone around the logo, in modules, 0–4
  clearModules: boolean; // hide modules behind the logo
}

export interface QrDesign {
  errorCorrection: ErrorCorrectionLevel;
  margin: number; // quiet zone in modules, 0–10
  body: { shape: BodyShape; fill: Fill };
  cornerFrame: { shape: CornerFrameShape; color: string | null }; // null = follow body fill
  cornerDot: { shape: CornerDotShape; color: string | null };
  background: { color: string; transparent: boolean };
  logo: LogoOptions | null;
}

export type Payload =
  | { kind: 'text'; text: string }
  | {
      kind: 'wifi';
      ssid: string;
      password: string;
      encryption: 'WPA' | 'WEP' | 'nopass';
      hidden: boolean;
    }
  | {
      kind: 'contact';
      firstName: string;
      lastName: string;
      organization: string;
      title: string;
      phone: string;
      email: string;
      website: string;
      address: string;
      note: string;
    }
  | { kind: 'email'; to: string; subject: string; body: string }
  | { kind: 'phone'; number: string }
  | { kind: 'sms'; number: string; message: string };
export type PayloadKind = Payload['kind'];
export interface PayloadIssue {
  field: string;
  message: string;
}

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
export interface ScanResult {
  decodable: boolean;
  matches: boolean;
  contrastRatio: number;
  warnings: string[];
}

export interface BatchRow {
  /** Original 1-based input line, when parsed from bulk input. */
  line?: number;
  data: string;
  filename: string;
}
export interface BatchParseResult {
  rows: BatchRow[];
  errors: { line: number; message: string }[];
}
export interface BatchOptions {
  format: 'png' | 'svg';
  sizePx: number;
  render: (data: string) => string;
  rasterize: (svg: string, sizePx: number) => Promise<Blob>;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}
