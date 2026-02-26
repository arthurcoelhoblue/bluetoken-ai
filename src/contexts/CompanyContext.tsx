import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

export type ActiveCompany = Database['public']['Enums']['empresa_tipo'];

export interface EmpresaRecord {
  id: string;
  label: string;
  color: string;
  is_active: boolean;
}

interface CompanyContextType {
  /** All currently selected companies */
  activeCompanies: ActiveCompany[];
  /** First selected company — backward compat for mutations */
  activeCompany: ActiveCompany;
  /** All companies available to the logged-in user */
  userCompanies: ActiveCompany[];
  /** Full empresa records from DB */
  empresaRecords: EmpresaRecord[];
  setActiveCompanies: (companies: ActiveCompany[]) => void;
  toggleCompany: (company: ActiveCompany) => void;
  companyLabel: string;
  isMultiCompany: boolean;
  /** Get label for a company ID */
  getCompanyLabel: (id: string) => string;
  /** Get color for a company ID */
  getCompanyColor: (id: string) => string;
}

const STORAGE_KEY = 'bluecrm-companies';
const OLD_STORAGE_KEY = 'bluecrm-company';

function loadInitialCompanies(): ActiveCompany[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ActiveCompany[];
      }
    } catch { /* ignore */ }
  }
  const old = localStorage.getItem(OLD_STORAGE_KEY);
  if (old === 'BLUE' || old === 'TOKENIZA') return [old];
  if (old === 'blue') return ['BLUE'];
  if (old === 'tokeniza') return ['TOKENIZA'];
  return ['BLUE'];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [userCompanies, setUserCompanies] = useState<ActiveCompany[]>([]);
  const [activeCompanies, setActiveCompaniesState] = useState<ActiveCompany[]>(loadInitialCompanies);

  // Load empresa records from DB
  const { data: empresaRecords = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, label, color, is_active')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as EmpresaRecord[];
    },
    staleTime: 5 * 60_000,
  });

  const getCompanyLabel = useCallback((id: string) => {
    return empresaRecords.find(e => e.id === id)?.label ?? id;
  }, [empresaRecords]);

  const getCompanyColor = useCallback((id: string) => {
    return empresaRecords.find(e => e.id === id)?.color ?? 'bg-primary';
  }, [empresaRecords]);

  const loadUserCompanies = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_access_assignments')
      .select('empresa')
      .eq('user_id', user.id);
    if (data && data.length > 0) {
      const companies = data.map(d => String(d.empresa)).filter(Boolean) as ActiveCompany[];
      setUserCompanies(companies);
      setActiveCompaniesState(prev => {
        const valid = prev.filter(c => companies.includes(c));
        return valid.length > 0 ? valid : [companies[0]];
      });
    }
  }, []);

  useEffect(() => {
    loadUserCompanies();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadUserCompanies();
      if (event === 'SIGNED_OUT') {
        setUserCompanies([]);
        setActiveCompaniesState(['BLUE']);
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [loadUserCompanies]);

  const setActiveCompanies = (companies: ActiveCompany[]) => {
    if (companies.length === 0) return;
    setActiveCompaniesState(companies);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  };

  const toggleCompany = (company: ActiveCompany) => {
    if (activeCompanies.includes(company)) {
      if (activeCompanies.length > 1) {
        setActiveCompanies(activeCompanies.filter(c => c !== company));
      }
    } else {
      setActiveCompanies([...activeCompanies, company]);
    }
  };

  const activeCompany: ActiveCompany = activeCompanies[0] ?? ('BLUE' as ActiveCompany);
  const companyLabel = activeCompanies.length === 1
    ? getCompanyLabel(activeCompanies[0])
    : `${activeCompanies.length} empresas`;
  const isMultiCompany = activeCompanies.length > 1;

  return (
    <CompanyContext.Provider value={{
      activeCompanies, activeCompany, userCompanies, empresaRecords,
      setActiveCompanies, toggleCompany, companyLabel, isMultiCompany,
      getCompanyLabel, getCompanyColor,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
