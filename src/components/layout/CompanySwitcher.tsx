import { Building2, ChevronDown } from 'lucide-react';
import { useCompany, type ActiveCompany } from '@/contexts/CompanyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options: { value: ActiveCompany; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue Consult', color: 'bg-primary' },
  { value: 'tokeniza', label: 'Tokeniza', color: 'bg-accent' },
  { value: 'all', label: 'Todas', color: 'bg-muted-foreground' },
];

export function CompanySwitcher({ collapsed }: { collapsed?: boolean }) {
  const { activeCompany, setActiveCompany, companyLabel } = useCompany();
  const current = options.find(o => o.value === activeCompany)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent transition-colors text-sidebar-foreground text-sm shadow-sm">
          <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${current.color}`}>
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
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setActiveCompany(opt.value)}
            className={activeCompany === opt.value ? 'bg-accent/10 font-medium' : ''}
          >
            <div className={`h-4 w-4 rounded mr-2 ${opt.color}`} />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
