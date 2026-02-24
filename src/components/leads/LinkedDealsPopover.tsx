import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Briefcase, ExternalLink } from 'lucide-react';

interface LinkedDeal {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  pipeline_id: string;
  pipeline_stages: { nome: string; cor: string } | null;
}

interface LinkedDealsPopoverProps {
  deals: LinkedDeal[];
}

export function LinkedDealsPopover({ deals }: LinkedDealsPopoverProps) {
  const navigate = useNavigate();

  if (!deals.length) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Briefcase className="h-4 w-4 mr-2" />
          Ver Deals ({deals.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <p className="text-sm font-medium">Deals vinculados</p>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y">
          {deals.map((deal) => (
            <button
              key={deal.id}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => navigate(`/deals?pipeline=${deal.pipeline_id}&deal=${deal.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deal.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{formatCurrency(deal.valor)}</span>
                  {deal.pipeline_stages && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                      style={{
                        borderColor: deal.pipeline_stages.cor || undefined,
                        color: deal.pipeline_stages.cor || undefined,
                      }}
                    >
                      {deal.pipeline_stages.nome}
                    </Badge>
                  )}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
