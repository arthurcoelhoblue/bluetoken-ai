import React, { createContext, useContext, useState } from 'react';

export type ActiveCompany = 'BLUE' | 'TOKENIZA';

interface CompanyContextType {
  activeCompany: ActiveCompany;
  setActiveCompany: (company: ActiveCompany) => void;
  companyLabel: string;
}

const LABELS: Record<ActiveCompany, string> = {
  BLUE: 'Blue Consult',
  TOKENIZA: 'Tokeniza',
};

const STORAGE_KEY = 'bluecrm-company';

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [activeCompany, setActiveCompanyState] = useState<ActiveCompany>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'BLUE' || stored === 'TOKENIZA') return stored;
    // Migrate old lowercase/ALL values
    if (stored === 'blue') return 'BLUE';
    if (stored === 'tokeniza') return 'TOKENIZA';
    return 'BLUE';
  });

  const setActiveCompany = (company: ActiveCompany) => {
    setActiveCompanyState(company);
    localStorage.setItem(STORAGE_KEY, company);
  };

  return (
    <CompanyContext.Provider value={{ activeCompany, setActiveCompany, companyLabel: LABELS[activeCompany] }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
