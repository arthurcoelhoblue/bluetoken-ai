// Pure business-logic functions extracted from cadence-runner edge function.
// These are side-effect-free and fully testable.

import type { CadenceRunStatus } from '@/types/cadence';

// ── Types ────────────────────────────────────────────────────
export type StepAction = 'EXECUTE' | 'COMPLETE' | 'STOP_RESPONDED';
export type RunAction = 'EXECUTE' | 'COMPLETE' | 'STOP_RESPONDED' | 'PAUSE';

export interface NextStepResult {
  action: StepAction;
  nextStep: number | null;
}

// ── computeNextStep ──────────────────────────────────────────
/**
 * Decides what to do with the current cadence run given its state.
 *
 * @param currentStep  - The step about to be executed (1-indexed).
 * @param totalSteps   - Total number of steps in the cadence.
 * @param leadRespondeu - Whether the lead has already replied.
 * @param pararSeResponder - Whether the cadence should stop if the lead replied.
 */
export function computeNextStep(
  currentStep: number,
  totalSteps: number,
  leadRespondeu: boolean,
  pararSeResponder: boolean,
): NextStepResult {
  // If lead responded and the step says to stop → complete
  if (leadRespondeu && pararSeResponder) {
    return { action: 'STOP_RESPONDED', nextStep: null };
  }

  // Beyond or at the last step → complete
  if (currentStep >= totalSteps) {
    return { action: 'COMPLETE', nextStep: null };
  }

  // Otherwise execute current and advance
  return { action: 'EXECUTE', nextStep: currentStep + 1 };
}

// ── computeNextRunAt ─────────────────────────────────────────
/**
 * Calculates the next execution timestamp by adding an offset in minutes.
 */
export function computeNextRunAt(baseDate: Date, offsetMinutos: number): Date {
  return new Date(baseDate.getTime() + offsetMinutos * 60_000);
}

// ── shouldSkipStep ───────────────────────────────────────────
/**
 * Returns true if the step should be skipped because the lead
 * doesn't have the required channel info.
 *
 * @param canal - The channel required by the step ('WHATSAPP' | 'EMAIL' | 'SMS' etc.)
 * @param leadTemCanal - Whether the lead has the required channel data.
 */
export function shouldSkipStep(canal: string, leadTemCanal: boolean): boolean {
  // Only skip for channels that require specific lead data
  if (['WHATSAPP', 'SMS'].includes(canal) && !leadTemCanal) return true;
  if (canal === 'EMAIL' && !leadTemCanal) return true;
  return false;
}

// ── resolveRunStatus ─────────────────────────────────────────
/**
 * Resolves the final run status given the current status and an action.
 * If the run is PAUSADA it stays PAUSADA regardless of action.
 */
export function resolveRunStatus(
  currentStatus: CadenceRunStatus,
  action: RunAction,
): CadenceRunStatus {
  if (currentStatus === 'PAUSADA') return 'PAUSADA';
  if (currentStatus === 'CANCELADA') return 'CANCELADA';

  switch (action) {
    case 'EXECUTE':
      return 'ATIVA';
    case 'COMPLETE':
    case 'STOP_RESPONDED':
      return 'CONCLUIDA';
    case 'PAUSE':
      return 'PAUSADA';
    default:
      return currentStatus;
  }
}
