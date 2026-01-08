import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HealthCheckResult {
  status: "online" | "offline" | "error" | "checking";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
  checkedAt?: Date;
}

export function useIntegrationHealth() {
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthCheckResult>>({});

  const checkHealth = async (integration: string): Promise<HealthCheckResult> => {
    setHealthStatus((prev) => ({
      ...prev,
      [integration]: { status: "checking" },
    }));

    try {
      const { data, error } = await supabase.functions.invoke("integration-health-check", {
        body: { integration },
      });

      if (error) {
        const result: HealthCheckResult = {
          status: "error",
          message: error.message,
          checkedAt: new Date(),
        };
        setHealthStatus((prev) => ({ ...prev, [integration]: result }));
        return result;
      }

      const result: HealthCheckResult = {
        ...data,
        checkedAt: new Date(),
      };
      setHealthStatus((prev) => ({ ...prev, [integration]: result }));
      return result;
    } catch (err) {
      const result: HealthCheckResult = {
        status: "error",
        message: err instanceof Error ? err.message : "Erro desconhecido",
        checkedAt: new Date(),
      };
      setHealthStatus((prev) => ({ ...prev, [integration]: result }));
      return result;
    }
  };

  const getStatus = (integration: string): HealthCheckResult | undefined => {
    return healthStatus[integration];
  };

  return {
    checkHealth,
    getStatus,
    healthStatus,
  };
}
