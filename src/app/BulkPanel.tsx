import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBatchInput, createBatchZip } from '../core/batch';
import { createBatchRasterizer } from '../core/export/png';
import { renderSvg } from '../core/render';
import { errorMessage, useAppStore } from './store';
import { ExportOptions, validPngSize } from './ExportOptions';

export function BulkPanel() {
  const { bulkInput, setBulkInput, design, exportOptions, setMode } =
    useAppStore();
  const parsed = useMemo(() => parseBatchInput(bulkInput), [bulkInput]);
  const preview = useMemo(() => {
    try {
      return parsed.rows[0]
        ? {
            svg: renderSvg(parsed.rows[0].data, design, { sizePx: 160 }),
            error: '',
          }
        : { svg: '', error: '' };
    } catch (error) {
      return { svg: '', error: errorMessage(error) };
    }
  }, [parsed, design]);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  const uploadRequest = useRef(0);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
      uploadRequest.current++;
    },
    [],
  );
  async function upload(file?: File) {
    if (!file || controller.current) return;
    const token = ++uploadRequest.current;
    try {
      if (!/\.(csv|txt)$/i.test(file.name))
        throw new Error('Choose a CSV or TXT file.');
      if (file.size > 10 * 1024 * 1024)
        throw new Error('Choose a file smaller than 10 MB.');
      const text = await file.text();
      if (token === uploadRequest.current && !controller.current) {
        setBulkInput(text);
        setMessage('File loaded.');
      }
    } catch (error) {
      if (token === uploadRequest.current) setMessage(errorMessage(error));
    }
  }
  async function generate() {
    if (controller.current || !parsed.rows.length) return;
    uploadRequest.current++;
    const aborter = new AbortController();
    controller.current = aborter;
    setProgress({ done: 0, total: parsed.rows.length });
    setMessage('Generating codes…');
    const rasterizer = createBatchRasterizer(aborter.signal);
    try {
      const blob = await createBatchZip(parsed.rows, {
        ...exportOptions,
        render: (data) => renderSvg(data, design),
        rasterize: rasterizer.rasterize,
        signal: aborter.signal,
        onProgress: (done, total) => {
          if (controller.current === aborter) setProgress({ done, total });
        },
      });
      if (aborter.signal.aborted || controller.current !== aborter) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `qr-codes-${Date.now()}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        'ZIP download ready. Any generation errors are listed in errors.txt inside the ZIP.',
      );
    } catch (error) {
      if (controller.current === aborter)
        setMessage(
          aborter.signal.aborted
            ? 'Generation cancelled.'
            : errorMessage(error),
        );
    } finally {
      rasterizer.dispose();
      if (controller.current === aborter) {
        controller.current = null;
        setProgress(null);
      }
    }
  }
  return (
    <section className="panel bulk-panel">
      <h2>Bulk</h2>
      <label className="field">
        One item per line, or CSV with data,filename columns
        <textarea
          rows={8}
          value={bulkInput}
          disabled={!!progress}
          onChange={(event) => {
            uploadRequest.current++;
            setBulkInput(event.target.value);
          }}
        />
      </label>
      <label
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files[0]);
        }}
      >
        Upload CSV/TXT or drop it here
        <input
          aria-label="Upload CSV or TXT"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          disabled={!!progress}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <p role="status">
        {parsed.rows.length} codes, {parsed.errors.length} errors
      </p>
      {!!parsed.errors.length && (
        <ul>
          {parsed.errors.map((error, index) => (
            <li key={index}>
              Line {error.line}: {error.message}
            </li>
          ))}
        </ul>
      )}
      <div className="bulk-design">
        {preview.svg && (
          <img
            width="160"
            height="160"
            alt="First bulk code preview"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`}
          />
        )}
        <p>Uses your current Single design.</p>
        {preview.error && <p role="status">{preview.error}</p>}
        <button
          type="button"
          disabled={!!progress}
          onClick={() => setMode('Single')}
        >
          Edit design
        </button>
      </div>
      <fieldset disabled={!!progress}>
        <legend>Export options</legend>
        <ExportOptions />
      </fieldset>
      <button
        className="primary"
        disabled={
          !!progress ||
          !parsed.rows.length ||
          (exportOptions.format === 'png' &&
            !validPngSize(exportOptions.sizePx))
        }
        onClick={() => void generate()}
      >
        Generate ZIP
      </button>
      {progress && (
        <div>
          <label>
            Generation progress{' '}
            <progress max={progress.total} value={progress.done} />
          </label>
          <p>
            {progress.done} / {progress.total}
          </p>
          <button
            onClick={() => {
              controller.current?.abort();
              setMessage('Cancelling…');
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
