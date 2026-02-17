import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ActiveCompany = 'BLUE' | 'TOKENIZA';

interface CompanyContextType {
  /** All currently selected companies */
  activeCompanies: ActiveCompany[];
  /** First selected company — backward compat for mutations */
  activeCompany: ActiveCompany;
  /** All companies available to the logged-in user */
  userCompanies: ActiveCompany[];
  setActiveCompanies: (companies: ActiveCompany[]) => void;
  toggleCompany: (company: ActiveCompany) => void;
  companyLabel: string;
  isMultiCompany: boolean;
}

const LABELS: Record<ActiveCompany, string> = {
  BLUE: 'Blue Consult',
  TOKENIZA: 'Tokeniza',
};

const STORAGE_KEY = 'bluecrm-companies';
const OLD_STORAGE_KEY = 'bluecrm-company';

function loadInitialCompanies(): ActiveCompany[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((c: string) => c === 'BLUE' || c === 'TOKENIZA') as ActiveCompany[];
        if (valid.length > 0) return valid;
      }
    } catch { /* ignore */ }
  }
  // Migrate from old single-value key
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

  const loadUserCompanies = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_access_assignments')
      .select('empresa')
      .eq('user_id', user.id);
    if (data && data.length > 0) {
      const companies = data.map(d => d.empresa).filter(Boolean) as ActiveCompany[];
      setUserCompanies(companies);
      // Ensure active selection is valid
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
      // Don't allow deselecting the last one
      if (activeCompanies.length > 1) {
        setActiveCompanies(activeCompanies.filter(c => c !== company));
      }
    } else {
      setActiveCompanies([...activeCompanies, company]);
    }
  };

  const activeCompany = activeCompanies[0] ?? 'BLUE';
  const companyLabel = activeCompanies.length === 1
    ? LABELS[activeCompanies[0]]
    : `${activeCompanies.length} empresas`;
  const isMultiCompany = activeCompanies.length > 1;

  return (
    <CompanyContext.Provider value={{
      activeCompanies, activeCompany, userCompanies,
      setActiveCompanies, toggleCompany, companyLabel, isMultiCompany,
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
