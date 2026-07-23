// src/util/cancel-token.ts
export class CancelledError extends Error {
  constructor() {
    super('Annulé par l\'utilisateur');
    this.name = 'CancelledError';
  }
}

export function isCancelledError(e: unknown): boolean {
  return e instanceof CancelledError;
}

export class CancelToken {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  throwIfCancelled(): void {
    if (this.cancelled) throw new CancelledError();
  }
}
