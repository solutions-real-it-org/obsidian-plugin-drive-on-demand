import { describe, it, expect } from 'vitest';
import { conflictName, defaultConflictLabel } from './conflict-name';

describe('conflictName', () => {
  it('insère « (conflit label) » avant l extension', () => {
    expect(conflictName('a/b/note.md', '2026-07-21')).toBe('a/b/note (conflit 2026-07-21).md');
    expect(conflictName('note.md', 'X')).toBe('note (conflit X).md');
    expect(conflictName('dir/sansext', 'X')).toBe('dir/sansext (conflit X)');
  });
});

describe('defaultConflictLabel', () => {
  it('formate en filesafe, résolution seconde, sans « : » ni « T »', () => {
    expect(defaultConflictLabel(new Date('2026-07-21T14:30:05.000Z'))).toBe('2026-07-21_14-30-05');
  });
});
