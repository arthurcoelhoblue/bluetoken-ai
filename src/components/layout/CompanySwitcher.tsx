import { Building2, ChevronDown, Check } from 'lucide-react';
import { useCompany, type ActiveCompany } from '@/contexts/CompanyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COMPANY_META: Record<string, { label: string; color: string }> = {
  BLUE: { label: 'Blue Consult', color: 'bg-primary' },
  TOKENIZA: { label: 'Tokeniza', color: 'bg-accent' },
};

export function CompanySwitcher({ collapsed }: { collapsed?: boolean }) {
  const { activeCompanies, userCompanies, toggleCompany, companyLabel } = useCompany();

  // If user only has access to 1 company, show static label
  if (userCompanies.length <= 1) {
    const current = COMPANY_META[activeCompanies[0]] ?? COMPANY_META.BLUE;
    return (
      <div className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground text-sm shadow-sm">
        <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${current.color}`}>
          <Building2 className="h-3 w-3 text-primary-foreground" />
        </div>
        {!collapsed && <span className="truncate flex-1 text-left text-xs font-medium">{current.label}</span>}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent transition-colors text-sidebar-foreground text-sm shadow-sm">
          <div className="h-5 w-5 rounded flex items-center justify-center shrink-0 bg-primary">
            <Building2 className="h-3 w-3 text-primary-foreground" />
          </div>
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left text-xs font-medium">{companyLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {userCompanies.map(company => {
          const meta = COMPANY_META[company] ?? { label: company, color: 'bg-muted' };
          const isSelected = activeCompanies.includes(company);
          return (
            <DropdownMenuItem
              key={company}
              onClick={(e) => {
                e.preventDefault();
                toggleCompany(company);
              }}
              className={isSelected ? 'bg-accent/10 font-medium' : ''}
            >
              <div className={`h-4 w-4 rounded mr-2 ${meta.color}`} />
              <span className="flex-1">{meta.label}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
