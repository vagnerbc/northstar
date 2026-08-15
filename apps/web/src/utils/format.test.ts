import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney } from './format';

describe('formatMoney', () => {
  it('keeps domain amounts in integer centavos', () => {
    expect(formatMoney(12_990)).toContain('129.90');
  });

  it('formats UTC timestamps for display', () => {
    expect(formatDate('2030-01-02T12:30:00.000Z')).toContain('2030');
  });
});
