import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScanStatus } from './ScanStatus';
import { checkScannability } from '../core/export/scan';
vi.mock('../core/export/scan', () => ({ checkScannability: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('shows successful scanning and exposes every warning', async () => {
  vi.mocked(checkScannability).mockResolvedValue({
    decodable: true,
    matches: true,
    contrastRatio: 21,
    warnings: [],
  });
  const view = render(<ScanStatus svg="first" expected="hello" />);
  expect(screen.getByText('Checking scan…')).toBeTruthy();
  await screen.findByText('Scannable');
  vi.mocked(checkScannability).mockResolvedValue({
    decodable: true,
    matches: true,
    contrastRatio: 2,
    warnings: ['Low contrast', 'Small quiet zone'],
  });
  view.rerender(<ScanStatus svg="second" expected="hello" />);
  await screen.findByText('May not scan · Low contrast');
  expect(screen.getByText('Small quiet zone')).toBeTruthy();
});
it('debounces changes and discards stale scan results', async () => {
  let finish: (
    value: Awaited<ReturnType<typeof checkScannability>>,
  ) => void = () => {};
  vi.mocked(checkScannability)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValue({
      decodable: false,
      matches: false,
      contrastRatio: 0,
      warnings: ['Latest warning'],
    });
  const view = render(<ScanStatus svg="old" expected="old" />);
  await waitFor(() => expect(checkScannability).toHaveBeenCalledOnce());
  view.rerender(<ScanStatus svg="intermediate" expected="intermediate" />);
  view.rerender(<ScanStatus svg="latest" expected="latest" />);
  await screen.findByText('May not scan · Latest warning');
  finish({ decodable: true, matches: true, contrastRatio: 21, warnings: [] });
  await waitFor(() => expect(screen.queryByText('Scannable')).toBeNull());
  expect(checkScannability).toHaveBeenCalledTimes(2);
});
