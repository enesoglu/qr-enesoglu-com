import { useEffect, useState } from 'react';
import { ScanStatus } from './ScanStatus';
import { svgToPngBlob } from '../core/export/png';
import { ExportOptions, validPngSize } from './ExportOptions';
import {
  encodedData,
  errorMessage,
  kindLabels,
  previewSvg,
  useAppStore,
} from './store';

export function downloadFilename(
  kind: string,
  format: string,
  date = new Date(),
) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `qr-${kind}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.${format}`;
}
export function PreviewCard() {
  const state = useAppStore();
  const { payloads, activeKind, design, exportOptions } = state;
  const [rendered, setRendered] = useState(() => ({
    ...previewSvg(state),
    payloads,
    activeKind,
    design,
  }));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setRendered({
          ...previewSvg({ payloads, activeKind, design }),
          payloads,
          activeKind,
          design,
        }),
      100,
    );
    return () => clearTimeout(timer);
  }, [payloads, activeKind, design]);
  const pending =
    rendered.payloads !== payloads ||
    rendered.activeKind !== activeKind ||
    rendered.design !== design;
  const validSize = validPngSize(exportOptions.sizePx);
  const ready =
    !!rendered.svg &&
    !pending &&
    !busy &&
    (exportOptions.format === 'svg' || validSize);
  const canCopy =
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function';
  async function exportImage(copy = false) {
    if (!ready) return;
    setBusy(true);
    setMessage(copy ? 'Copying image…' : 'Preparing download…');
    try {
      const blob =
        exportOptions.format === 'png' || copy
          ? await svgToPngBlob(rendered.svg, exportOptions.sizePx)
          : new Blob([rendered.svg], { type: 'image/svg+xml' });
      if (copy) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setMessage('Image copied.');
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = downloadFilename(activeKind, exportOptions.format);
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Download ready.');
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="preview-card" aria-label="QR preview and download">
      <div className="preview-heading">
        <h2>Preview</h2>
        <span>{kindLabels[activeKind]}</span>
      </div>
      <div
        className={`preview-image ${design.background.transparent ? 'checkerboard' : ''}`}
        aria-busy={pending}
      >
        {rendered.svg ? (
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered.svg)}`}
            width="320"
            height="320"
            alt={`QR code preview for ${kindLabels[rendered.activeKind]}`}
          />
        ) : (
          <p>{rendered.error || 'Enter text to generate a QR code.'}</p>
        )}
      </div>
      <ScanStatus
        svg={pending ? '' : rendered.svg}
        expected={encodedData({ payloads, activeKind }).data}
      />
      <div className="export-controls">
        <ExportOptions />
        <button
          className="primary"
          disabled={!ready}
          onClick={() => void exportImage()}
        >
          Download {exportOptions.format.toUpperCase()}
        </button>
        {canCopy && (
          <button
            disabled={!ready || !validSize}
            onClick={() => void exportImage(true)}
          >
            Copy image
          </button>
        )}
        {!canCopy && (
          <p className="status">
            Image copying is unavailable in this browser. Download the image
            instead.
          </p>
        )}
        <p className="status" role="status">
          {message}
        </p>
      </div>
    </aside>
  );
}
