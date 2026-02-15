import { describe, it, expect } from 'vitest';
import { getBestSendTime, type OptimalHour } from '../useFollowUpHours';

describe('getBestSendTime', () => {
  it('returns formatted string for valid data', () => {
    const hours: OptimalHour[] = [
      { dia_semana: 2, hora: 10, taxa_resposta: 45, total_envios: 100 },
      { dia_semana: 4, hora: 14, taxa_resposta: 30, total_envios: 80 },
    ];
    const result = getBestSendTime(hours);
    expect(result).toBe('Terça às 10h (45% resposta)');
  });

  it('returns fallback for empty array', () => {
    expect(getBestSendTime([])).toBe('Sem dados suficientes');
  });

  it('returns fallback for undefined', () => {
    expect(getBestSendTime(undefined as any)).toBe('Sem dados suficientes');
  });

  it('handles Sunday (dia_semana=0)', () => {
    const hours: OptimalHour[] = [
      { dia_semana: 0, hora: 9, taxa_resposta: 60, total_envios: 50 },
    ];
    expect(getBestSendTime(hours)).toBe('Domingo às 9h (60% resposta)');
  });

  it('handles Saturday (dia_semana=6)', () => {
    const hours: OptimalHour[] = [
      { dia_semana: 6, hora: 15, taxa_resposta: 22.7, total_envios: 30 },
    ];
    expect(getBestSendTime(hours)).toBe('Sábado às 15h (23% resposta)');
  });
});
