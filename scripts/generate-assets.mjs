import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const output = new URL('../public/', import.meta.url);
const icon = await readFile(new URL('icon.svg', output), 'utf8');
const rasterize = (svg, width) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
])
  await writeFile(new URL(name, output), rasterize(icon, size));

// All foreground artwork fits inside the central 80% safe circle.
const maskable = icon
  .replace('rx="112"', 'rx="0"')
  .replace(
    '<g fill="none"',
    '<g transform="translate(64 64) scale(.75)"><g fill="none"',
  )
  .replace('</svg>', '</g></svg>');
await writeFile(
  new URL('icon-maskable-512.png', output),
  rasterize(maskable, 512),
);

// ICO directory containing a PNG image, supported by modern browsers.
const favicon = rasterize(icon, 48);
const directory = Buffer.alloc(22);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(1, 4);
directory[6] = directory[7] = 48;
directory.writeUInt16LE(1, 10);
directory.writeUInt16LE(32, 12);
directory.writeUInt32LE(favicon.length, 14);
directory.writeUInt32LE(22, 18);
await writeFile(
  new URL('favicon.ico', output),
  Buffer.concat([directory, favicon]),
);

const glyph = icon.replace(
  /<svg[^>]*>/,
  '<svg x="80" y="130" width="370" height="370" viewBox="0 0 512 512">',
);
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fafafa"/>
  ${glyph}
  <g fill="#18181b" font-family="Segoe UI, -apple-system, sans-serif">
    <text x="490" y="300" font-size="70" font-weight="600">QR Generator</text>
    <text x="493" y="364" font-size="28">Free. Private. Works offline.</text>
  </g>
</svg>`;
await writeFile(new URL('og.png', output), rasterize(social, 1200));
