import { describe, it, expect } from 'vitest';
import { cn, safeFormat } from './utils';

describe('Utility Functions', () => {
  describe('cn (Tailwind Merge)', () => {
    it('merges tailwind classes correctly', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
      expect(cn('flex items-center', 'justify-between')).toBe('flex items-center justify-between');
    });

    it('handles conditional classes', () => {
      expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
    });
  });

  describe('safeFormat (Date Formatting)', () => {
    it('formats valid ISO dates correctly', () => {
      expect(safeFormat('2024-04-21', 'dd-MMM-yyyy')).toBe('21-Apr-2024');
    });

    it('returns "-" for null or non-string inputs', () => {
      expect(safeFormat(null)).toBe('—');
      expect(safeFormat(undefined)).toBe('—');
      expect(safeFormat(123)).toBe('—');
    });

    it('returns the input string if it is not a valid date', () => {
      expect(safeFormat('not-a-date')).toBe('not-a-date');
    });
  });
});
