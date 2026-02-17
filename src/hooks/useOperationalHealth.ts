import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationStatus {
  name: string;
  label: string;
  status: "online" | "offline" | "error" | "checking" | "unknown";
  latencyMs?: number;
  message?: string;
  checkedAt?: Date;
}

export interface CronStatus {
  functionName: string;
  lastRun?: string;
  consecutiveFailures?: number;
}

const INTEGRATIONS = [
  { name: 'whatsapp', label: 'WhatsApp' },
  { name: 'pipedrive', label: 'Pipedrive' },
  { name: 'claude', label: 'Claude AI' },
  { name: 'gemini', label: 'Gemini AI' },
  { name: 'smtp', label: 'SMTP Email' },
  { name: 'sgt', label: 'SGT' },
  { name: 'bluechat', label: 'Blue Chat' },
  { name: 'zadarma', label: 'Zadarma' },
];

const CRON_FUNCTIONS = [
  'cadence-runner', 'deal-scoring', 'cs-health-calculator', 'cs-ai-actions',
  'cs-scheduled-jobs', 'follow-up-scheduler', 'icp-learner', 'copilot-proactive',
  'faq-auto-review', 'weekly-report', 'integration-health-check', 'revenue-forecast',
];

export function useOperationalHealth() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(
    INTEGRATIONS.map(i => ({ ...i, status: 'unknown' as const }))
  );
  const [cronStatuses, setCronStatuses] = useState<CronStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const checkAll = useCallback(async () => {
    setLoading(true);

    // Set all to checking
    setIntegrations(prev => prev.map(i => ({ ...i, status: 'checking' as const })));

    // Check all integrations in parallel
    const results = await Promise.allSettled(
      INTEGRATIONS.map(async (integration) => {
        const start = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke('integration-health-check', {
            body: { integration: integration.name },
          });
          const latencyMs = Date.now() - start;
          if (error) return { ...integration, status: 'error' as const, message: error.message, latencyMs, checkedAt: new Date() };
          return { ...integration, status: data?.status || 'error', message: data?.message, latencyMs, checkedAt: new Date() };
        } catch (err) {
          return { ...integration, status: 'error' as const, message: String(err), latencyMs: Date.now() - start, checkedAt: new Date() };
        }
      })
    );

    setIntegrations(results.map(r => r.status === 'fulfilled' ? r.value : { name: '', label: '', status: 'error' as const }));

    // Fetch CRON statuses from system_settings
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['cron_last_run', 'consecutive_failures']);

      const lastRuns = (settings?.find(s => s.key === 'cron_last_run')?.value || {}) as Record<string, string>;
      const failures = (settings?.find(s => s.key === 'consecutive_failures')?.value || {}) as Record<string, number>;

      setCronStatuses(CRON_FUNCTIONS.map(fn => ({
        functionName: fn,
        lastRun: lastRuns[fn],
        consecutiveFailures: failures[fn] || 0,
      })));
    } catch { /* ignore */ }

    setLoading(false);
  }, []);

  return { integrations, cronStatuses, loading, checkAll, CRON_FUNCTIONS };
}
