import type { QrDesign } from './types';

export const DEFAULT_DESIGN: QrDesign = {
  errorCorrection: 'M',
  margin: 4,
  body: { shape: 'square', fill: { type: 'solid', color: '#000000' } },
  cornerFrame: { shape: 'square', color: null },
  cornerDot: { shape: 'square', color: null },
  background: { color: '#ffffff', transparent: false },
  logo: null,
};
