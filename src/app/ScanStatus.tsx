import { useEffect, useState } from 'react';
import type { ScanResult } from '../core/types';
import { errorMessage } from './store';

export function ScanStatus({
  svg,
  expected,
}: {
  svg: string;
  expected: string;
}) {
  const [checked, setChecked] = useState<{
    svg: string;
    expected: string;
    result: ScanResult;
  } | null>(null);
  useEffect(() => {
    if (!svg) return;
    let current = true;
    const timer = setTimeout(() => {
      void import('../core/export/scan')
        .then(({ checkScannability }) => checkScannability(svg, expected))
        .then((result) => {
          if (current) setChecked({ svg, expected, result });
        })
        .catch((error: unknown) => {
          if (current)
            setChecked({
              svg,
              expected,
              result: {
                decodable: false,
                matches: false,
                contrastRatio: 0,
                warnings: [errorMessage(error)],
              },
            });
        });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [svg, expected]);
  const result =
    checked?.svg === svg && checked.expected === expected
      ? checked.result
      : null;
  return (
    <div className="scan-status">
      <p role="status">
        {!svg
          ? 'Enter valid content to check scanning.'
          : !result
            ? 'Checking scan…'
            : result.matches && result.decodable && !result.warnings.length
              ? 'Scannable'
              : `May not scan${result.warnings[0] ? ` · ${result.warnings[0]}` : ''}`}
      </p>
      {!!result?.warnings.length && (
        <details>
          <summary>All scan warnings ({result.warnings.length})</summary>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
