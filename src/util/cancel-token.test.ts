import { describe, it, expect } from 'vitest';
import { CancelToken, CancelledError, isCancelledError } from './cancel-token';

describe('CancelToken', () => {
  it('throwIfCancelled est un no-op avant cancel()', () => {
    const token = new CancelToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
    expect(token.isCancelled).toBe(false);
  });

  it('throwIfCancelled lève CancelledError après cancel()', () => {
    const token = new CancelToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
    expect(() => token.throwIfCancelled()).toThrow(CancelledError);
  });

  it('isCancelledError identifie une CancelledError et rejette une Error classique', () => {
    expect(isCancelledError(new CancelledError())).toBe(true);
    expect(isCancelledError(new Error('autre'))).toBe(false);
    expect(isCancelledError('not an error')).toBe(false);
  });
});
