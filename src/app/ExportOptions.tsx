import { useState } from 'react';
import { RadioGroup } from '../components/Controls';
import { useAppStore } from './store';
export function validPngSize(size: number) {
  return Number.isInteger(size) && size >= 64 && size <= 8192;
}
export function ExportOptions() {
  const { exportOptions, setExport } = useAppStore();
  const [customSize, setCustomSize] = useState(false);
  const validSize = validPngSize(exportOptions.sizePx);
  return (
    <>
      {' '}
      <RadioGroup
        label="Format"
        value={exportOptions.format}
        options={['png', 'svg']}
        onChange={(format) => setExport({ format })}
      />
      {exportOptions.format === 'png' && (
        <>
          <label className="field">
            PNG size
            <select
              value={
                !customSize &&
                [512, 1024, 2048, 4096].includes(exportOptions.sizePx)
                  ? exportOptions.sizePx
                  : 'custom'
              }
              onChange={(event) => {
                setCustomSize(event.target.value === 'custom');
                if (event.target.value === 'custom')
                  setExport({ sizePx: 1500 });
                else setExport({ sizePx: Number(event.target.value) });
              }}
            >
              <option value={512}>512 × 512</option>
              <option value={1024}>1024 × 1024</option>
              <option value={2048}>2048 × 2048</option>
              <option value={4096}>4096 × 4096</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {customSize && (
            <label className="field">
              Size in pixels
              <input
                type="number"
                min={64}
                max={8192}
                step={1}
                value={exportOptions.sizePx || ''}
                aria-invalid={!validSize}
                onChange={(event) =>
                  setExport({ sizePx: Number(event.target.value) })
                }
              />
            </label>
          )}
          {!validSize && (
            <small role="status">Choose a whole number from 64 to 8192.</small>
          )}
        </>
      )}
    </>
  );
}
