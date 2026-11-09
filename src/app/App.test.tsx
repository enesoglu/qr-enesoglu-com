import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

it('updates the preview as text changes and handles empty input', () => {
  render(<App />);
  const initial = screen.getByRole('img').getAttribute('src');
  fireEvent.change(screen.getByLabelText('Text or URL'), {
    target: { value: 'Hello' },
  });
  expect(screen.getByRole('img').getAttribute('src')).not.toBe(initial);
  fireEvent.change(screen.getByLabelText('Text or URL'), {
    target: { value: '' },
  });
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('Enter text to generate a QR code.')).toBeTruthy();
});
