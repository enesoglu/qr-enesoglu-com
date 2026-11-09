# Architecture

The application generates QR codes locally with a small, quiet interface. Content never leaves the device: there is no server, account system, tracking, or cookie storage. Local processing also allows future offline use without sending sensitive Wi-Fi or contact details to another service.

## Data flow

```text
Payload → encodePayload → string → renderSvg(design) → SVG → (PNG | SVG | ZIP)
```

`src/core/types.ts` is the source of truth for contracts: `Payload` and `PayloadIssue` describe content and validation; `QrDesign` combines error correction, quiet zone, module shapes, fills, corner colors, background, and an optional logo. `ImageDataLike` and `ScanResult` decouple scanning from browser objects. `BatchRow`, `BatchParseResult`, and `BatchOptions` describe bulk input, diagnostics, render/rasterize callbacks, progress, and cancellation.

## Responsibilities

| Module                        | Responsibility and public entry points                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `core/payloads`               | `encodePayload`, `validatePayload`, and `createEmptyPayload`                                                          |
| `core/render`                 | `renderSvg` encodes using `qrcode.create()` and renders its matrix; `QrDataTooLongError` identifies capacity failures |
| `core/export/png`             | `svgToPngBlob` loads an SVG into browser canvas and preserves alpha                                                   |
| `core/export/scan`            | `decodeImageData`, `contrastRatio`, and browser wrapper `checkScannability`                                           |
| `core/batch`                  | `parseBatchInput` and `createBatchZip`                                                                                |
| `app`, `components`, `styles` | React interface, reusable controls, and Tailwind CSS                                                                  |

Core has no React imports. Browser-only APIs are confined to the PNG exporter and scanning wrapper. Tests rasterize SVG with resvg and decode pixels with jsQR, independently checking the rendering pipeline.

## Current behavior

All content kinds encode and validate locally. Body and corner shapes, gradients, logos, transparency, quiet zone, live preview, PNG/SVG downloads and debounced scan diagnostics are connected to the renderer. Scan diagnostics load lazily and expose decoding, contrast, quiet-zone and logo warnings. Bulk generation and design persistence are pending. PWA registration and offline caching are not enabled.

## Tooling compatibility

Node 26 LTS and Corepack select the toolchain. TypeScript 7 performs builds; the `typescript` package alias provides the TypeScript 6 API needed by typescript-eslint, following Microsoft's side-by-side guidance. ESLint uses the latest 9.x release because the current JSX accessibility plugin does not declare support for ESLint 10. Revisit these compatibility choices when the plugins support newer APIs.
