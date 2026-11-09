import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BulkPanel } from './BulkPanel';
import { useAppStore, defaultDesign } from './store';
import { createBatchZip } from '../core/batch';
vi.mock('../core/batch', async (original) => ({
  ...(await original<typeof import('../core/batch')>()),
  createBatchZip: vi.fn(),
}));
vi.mock('../core/export/png', () => ({
  createBatchRasterizer: () => ({ rasterize: vi.fn(), dispose: vi.fn() }),
}));
beforeEach(() => {
  useAppStore.setState({
    bulkInput: '',
    design: defaultDesign(),
    exportOptions: { format: 'svg', sizePx: 1024 },
    mode: 'Bulk',
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('parses row summaries with original line diagnostics and preserves input while editing design', () => {
  render(<BulkPanel />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'data,filename\none,first\n,missing\ntwo,second' },
  });
  expect(screen.getByText('2 codes, 1 errors')).toBeTruthy();
  expect(screen.getByText('Line 3: Data is required')).toBeTruthy();
  expect(screen.getByAltText('First bulk code preview')).toBeTruthy();
  fireEvent.click(screen.getByText('Edit design'));
  expect(useAppStore.getState().mode).toBe('Single');
  expect(useAppStore.getState().bulkInput).toContain('one,first');
});
it('cancels an in-flight generation using its abort signal', async () => {
  vi.mocked(createBatchZip).mockImplementation(
    (_rows, options) =>
      new Promise((_resolve, reject) => {
        options.onProgress?.(1, 3);
        options.signal?.addEventListener(
          'abort',
          () => reject(new Error('cancelled')),
          { once: true },
        );
      }),
  );
  useAppStore.setState({ bulkInput: 'one\ntwo\nthree' });
  render(<BulkPanel />);
  fireEvent.click(screen.getByText('Generate ZIP'));
  expect(screen.getByRole<HTMLProgressElement>('progressbar').value).toBe(1);
  fireEvent.click(screen.getByText('Cancel'));
  await screen.findByText('Generation cancelled.');
  expect(vi.mocked(createBatchZip).mock.calls.at(-1)?.[1].signal?.aborted).toBe(
    true,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
});
it('aborts generation when the panel unmounts', async () => {
  vi.mocked(createBatchZip).mockImplementation(
    (_rows, options) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new Error('cancelled')),
          { once: true },
        );
      }),
  );
  useAppStore.setState({ bulkInput: 'one' });
  const view = render(<BulkPanel />);
  fireEvent.click(screen.getByText('Generate ZIP'));
  view.unmount();
  await waitFor(() =>
    expect(
      vi.mocked(createBatchZip).mock.calls.at(-1)?.[1].signal?.aborted,
    ).toBe(true),
  );
});
