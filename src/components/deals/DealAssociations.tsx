import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, Building2, Plus, X, Search, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneBR } from '@/lib/formatPhone';
import { toast } from 'sonner';
import type { DealFullDetail } from '@/types/deal';
import type { UseMutationResult } from '@tanstack/react-query';

interface Props {
  deal: DealFullDetail;
  updateField: UseMutationResult<unknown, Error, { dealId: string; field: string; value: unknown }>;
  onContactClick?: (contactId: string) => void;
  onOrgClick?: (orgId: string) => void;
}

function useSearchContacts(search: string) {
  const [results, setResults] = useState<{ id: string; nome: string; email: string | null; telefone: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('contacts')
        .select('id, nome, email, telefone')
        .ilike('nome', `%${search}%`)
        .eq('is_active', true)
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return { results, loading };
}

function useSearchOrgs(search: string) {
  const [results, setResults] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('organizations')
        .select('id, nome')
        .ilike('nome', `%${search}%`)
        .eq('ativo', true)
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return { results, loading };
}

export function DealAssociations({ deal, updateField, onContactClick, onOrgClick }: Props) {
  const [contactSearch, setContactSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [contactPopover, setContactPopover] = useState(false);
  const [orgPopover, setOrgPopover] = useState(false);

  const contactResults = useSearchContacts(contactSearch);
  const orgResults = useSearchOrgs(orgSearch);

  const hasContact = !!deal.contact_id;
  const hasOrg = !!deal.organization_id;

  const handleAssociate = (field: string, value: string) => {
    updateField.mutate({ dealId: deal.id, field, value }, {
      onSuccess: () => {
        toast.success('Associação atualizada');
        if (field === 'contact_id') { setContactPopover(false); setContactSearch(''); }
        else { setOrgPopover(false); setOrgSearch(''); }
      },
    });
  };

  const handleUnassociate = (field: string) => {
    updateField.mutate({ dealId: deal.id, field, value: null }, {
      onSuccess: () => toast.success('Associação removida'),
    });
  };

  return (
    <div className="space-y-3">
      {/* Contact Section */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            Contato {hasContact ? '(1)' : '(0)'}
          </div>
          <Popover open={contactPopover} onOpenChange={setContactPopover}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                <Plus className="h-3 w-3" />
                {hasContact ? 'Trocar' : 'Associar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar contato..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="h-8 pl-7 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {contactResults.loading && <p className="text-xs text-muted-foreground p-2">Buscando...</p>}
                {!contactResults.loading && contactSearch.length >= 2 && contactResults.results.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Nenhum contato encontrado</p>
                )}
                {contactResults.results.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAssociate('contact_id', c.id)}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent text-sm transition-colors"
                  >
                    <p className="font-medium truncate">{c.nome}</p>
                    {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {hasContact ? (
          <div className="px-3 py-2.5">
            <button
              onClick={() => onContactClick?.(deal.contact_id)}
              className="text-sm font-medium text-primary hover:underline cursor-pointer"
            >
              {deal.contact_nome || 'Sem nome'}
            </button>
            <div className="mt-1 space-y-0.5">
              {deal.contact_email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{deal.contact_email}</span>
                </div>
              )}
              {deal.contact_telefone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{formatPhoneBR(deal.contact_telefone)}</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1"
                onClick={() => handleUnassociate('contact_id')}
              >
                <X className="h-3 w-3" />
                Desassociar
              </Button>
            </div>
          </div>
        ) : (
          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhum contato associado</p>
        )}
      </div>

      {/* Organization Section */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Organização {hasOrg ? '(1)' : '(0)'}
          </div>
          <Popover open={orgPopover} onOpenChange={setOrgPopover}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                <Plus className="h-3 w-3" />
                {hasOrg ? 'Trocar' : 'Associar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar organização..."
                  value={orgSearch}
                  onChange={e => setOrgSearch(e.target.value)}
                  className="h-8 pl-7 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {orgResults.loading && <p className="text-xs text-muted-foreground p-2">Buscando...</p>}
                {!orgResults.loading && orgSearch.length >= 2 && orgResults.results.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Nenhuma organização encontrada</p>
                )}
                {orgResults.results.map(o => (
                  <button
                    key={o.id}
                    onClick={() => handleAssociate('organization_id', o.id)}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent text-sm transition-colors"
                  >
                    <p className="font-medium truncate">{o.nome}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {hasOrg ? (
          <div className="px-3 py-2.5">
            <button
              onClick={() => deal.organization_id && onOrgClick?.(deal.organization_id)}
              className="text-sm font-medium text-primary hover:underline cursor-pointer"
            >
              {deal.org_nome || 'Sem nome'}
            </button>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1"
                onClick={() => handleUnassociate('organization_id')}
              >
                <X className="h-3 w-3" />
                Desassociar
              </Button>
            </div>
          </div>
        ) : (
          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhuma organização associada</p>
        )}
      </div>
    </div>
  );
}
