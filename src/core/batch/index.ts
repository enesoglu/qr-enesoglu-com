import { NotImplementedError } from '../errors';
import type { BatchOptions, BatchRow } from '../types';

export { parseBatchInput } from './parse';

export async function createBatchZip(
  _rows: BatchRow[],
  _options: BatchOptions,
): Promise<Blob> {
  throw new NotImplementedError('Batch export');
}
