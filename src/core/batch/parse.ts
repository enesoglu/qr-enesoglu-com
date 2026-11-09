import Papa from 'papaparse';
import type { BatchParseResult, BatchRow } from '../types';
import { createFilenameAllocator } from './filenames';

export function parseBatchInput(
  input: string,
  { maxRows = 1000 }: { maxRows?: number } = {},
): BatchParseResult {
  if (!Number.isInteger(maxRows) || maxRows < 0)
    throw new RangeError('maxRows must be a non-negative integer');
  const source = input.replace(/^\ufeff/, '');
  const rows: BatchRow[] = [];
  const errors: BatchParseResult['errors'] = [];
  let cursor = 0;
  let line = 1;
  let firstRow = true;
  let warnedExtraColumns = false;

  Papa.parse<string[]>(source, {
    delimitersToGuess: [',', '\t'],
    skipEmptyLines: false,
    step(result, parser) {
      const rowLine = line;
      line += (
        source.slice(cursor, result.meta.cursor).match(/\r\n|\r|\n/g) ?? []
      ).length;
      cursor = result.meta.cursor;
      const cells = result.data;
      for (const error of result.errors) {
        // A single-column input is valid even when no delimiter can be guessed.
        if (error.code !== 'UndetectableDelimiter')
          errors.push({ line: rowLine, message: error.message });
      }
      if (cells.every((cell) => !cell.trim())) return;
      if (cells.length > 2 && !warnedExtraColumns) {
        errors.push({ line: rowLine, message: 'Extra columns are ignored' });
        warnedExtraColumns = true;
      }
      const data = cells[0] ?? '';
      const header = firstRow && /^(data|content|text|url)$/i.test(data.trim());
      firstRow = false;
      if (header) return;
      if (!data.trim()) {
        errors.push({ line: rowLine, message: 'Data is required' });
        return;
      }
      if (rows.length >= maxRows) {
        errors.push({
          line: rowLine,
          message: `Input is limited to ${maxRows} rows`,
        });
        parser.abort();
        return;
      }
      rows.push({ data, filename: cells[1] ?? '', line: rowLine });
    },
  });
  const allocate = createFilenameAllocator(rows.length);
  rows.forEach((row, index) => {
    row.filename = allocate(row.filename, index);
  });
  return { rows, errors };
}
