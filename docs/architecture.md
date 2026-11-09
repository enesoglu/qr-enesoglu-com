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

Text encoding, empty payload creation for every content kind, square SVG rendering with solid body/corner colors, background transparency, quiet zone, PNG export, and a live text preview work. Shape variants, gradients, and logos are deferred; gradients currently use their first stop. Other encoders, non-text validation, scanning, and bulk functions throw `NotImplementedError`. Zustand, PWA, ZIP, CSV, icons, and scanning dependencies are installed for extending those modules without lockfile conflicts. PWA registration and offline caching are not enabled yet.

## Tooling compatibility

Node 26 LTS and Corepack select the toolchain. TypeScript 7 performs builds; the `typescript` package alias provides the TypeScript 6 API needed by typescript-eslint, following Microsoft's side-by-side guidance. ESLint uses the latest 9.x release because the current JSX accessibility plugin does not declare support for ESLint 10. Revisit these compatibility choices when the plugins support newer APIs.
