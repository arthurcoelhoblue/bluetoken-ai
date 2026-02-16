import { useState } from 'react';
import { useSGTLeadSearch } from '@/hooks/useSGTLeadSearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { ChevronDown, ChevronUp, Mail, Phone, Search, UserCheck, UserX } from 'lucide-react';

export function SGTLeadSearchCard() {
  const [open, setOpen] = useState(false);
  const [searchType, setSearchType] = useState<'email' | 'telefone'>('email');
  const [inputValue, setInputValue] = useState('');
  const { mutate, data, isPending, reset } = useSGTLeadSearch();

  const handleSearch = () => {
    if (!inputValue.trim()) return;
    mutate(
      searchType === 'email'
        ? { email: inputValue.trim() }
        : { telefone: inputValue.trim() }
    );
  };

  const handleClear = () => {
    setInputValue('');
    reset();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="mb-6">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Buscar Lead no SGT
                </CardTitle>
              </div>
              {open ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Toggle email/telefone */}
            <ToggleGroup
              type="single"
              value={searchType}
              onValueChange={(v) => {
                if (v) {
                  setSearchType(v as 'email' | 'telefone');
                  handleClear();
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="email" size="sm">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Email
              </ToggleGroupItem>
              <ToggleGroupItem value="telefone" size="sm">
                <Phone className="h-3.5 w-3.5 mr-1.5" />
                Telefone
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Search input */}
            <div className="flex gap-2">
              <Input
                placeholder={
                  searchType === 'email'
                    ? 'Digite o email do lead...'
                    : 'Digite o telefone do lead...'
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                type={searchType === 'email' ? 'email' : 'tel'}
              />
              <Button onClick={handleSearch} disabled={isPending || !inputValue.trim()}>
                {isPending ? 'Buscando...' : 'Buscar'}
              </Button>
              {data && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Loading */}
            {isPending && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {/* Results */}
            {data && !isPending && <SGTResultDisplay data={data} />}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SGTResultDisplay({ data }: { data: any }) {
  // Handle not found
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <UserX className="h-4 w-4" />
        <span className="text-sm">Nenhum lead encontrado no SGT.</span>
      </div>
    );
  }

  // Normalize to array
  const leads = Array.isArray(data) ? data : [data];

  return (
    <div className="space-y-3">
      {leads.map((lead: any, idx: number) => (
        <div
          key={lead.id || idx}
          className="rounded-lg border p-3 space-y-2 bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">
              {lead.nome || lead.primeiro_nome || 'Sem nome'}
            </span>
            <div className="flex gap-1.5">
              {lead.is_cliente ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Cliente
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Lead
                </Badge>
              )}
              {lead.empresa && (
                <Badge variant="secondary">{lead.empresa}</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {lead.email && (
              <div>
                <span className="font-medium text-foreground/70">Email:</span>{' '}
                {lead.email}
              </div>
            )}
            {lead.telefone && (
              <div>
                <span className="font-medium text-foreground/70">Tel:</span>{' '}
                {lead.telefone}
              </div>
            )}
            {lead.lead_id && (
              <div>
                <span className="font-medium text-foreground/70">Lead ID:</span>{' '}
                {lead.lead_id}
              </div>
            )}
            {lead.status && (
              <div>
                <span className="font-medium text-foreground/70">Status:</span>{' '}
                {lead.status}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
