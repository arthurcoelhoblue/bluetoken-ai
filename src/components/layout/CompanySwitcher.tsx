import { Building2, ChevronDown, Check } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CompanySwitcher({ collapsed }: { collapsed?: boolean }) {
  const { activeCompanies, userCompanies, toggleCompany, companyLabel, getCompanyLabel, getCompanyColor } = useCompany();

  if (userCompanies.length <= 1) {
    const color = getCompanyColor(activeCompanies[0]);
    const label = getCompanyLabel(activeCompanies[0]);
    return (
      <div className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground text-sm shadow-sm">
        <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${color}`}>
          <Building2 className="h-3 w-3 text-primary-foreground" />
        </div>
        {!collapsed && <span className="truncate flex-1 text-left text-xs font-medium">{label}</span>}
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
          const color = getCompanyColor(company);
          const label = getCompanyLabel(company);
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
              <div className={`h-4 w-4 rounded mr-2 ${color}`} />
              <span className="flex-1">{label}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
