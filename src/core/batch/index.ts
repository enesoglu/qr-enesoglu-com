import { NotImplementedError } from '../errors';
import type { BatchOptions, BatchParseResult, BatchRow } from '../types';

export function parseBatchInput(
  _input: string,
  _opts?: { maxRows?: number },
): BatchParseResult {
  throw new NotImplementedError('Batch parsing');
}

export async function createBatchZip(
  _rows: BatchRow[],
  _options: BatchOptions,
): Promise<Blob> {
  throw new NotImplementedError('Batch export');
}
