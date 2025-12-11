import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pessoa, EmpresaRelacionamentoResumo, PessoaRelacaoTipo } from '@/types/pessoa';

interface UsePessoaContextOptions {
  leadId: string;
  empresa: 'TOKENIZA' | 'BLUE';
  enabled?: boolean;
}

interface PessoaContextData {
  pessoa: Pessoa | null;
  relacionamentos: EmpresaRelacionamentoResumo[];
}

export function usePessoaContext({ leadId, empresa, enabled = true }: UsePessoaContextOptions) {
  return useQuery({
    queryKey: ['pessoa-context', leadId, empresa],
    queryFn: async (): Promise<PessoaContextData> => {
      // 1. Buscar lead_contact para obter pessoa_id
      const { data: contact, error: contactError } = await supabase
        .from('lead_contacts')
        .select('pessoa_id, tokeniza_investor_id, blue_client_id')
        .eq('lead_id', leadId)
        .eq('empresa', empresa)
        .maybeSingle();

      if (contactError) throw contactError;
      if (!contact?.pessoa_id) {
        return { pessoa: null, relacionamentos: [] };
      }

      // 2. Buscar dados da pessoa
      const { data: pessoa, error: pessoaError } = await supabase
        .from('pessoas')
        .select('*')
        .eq('id', contact.pessoa_id)
        .single();

      if (pessoaError) throw pessoaError;

      // 3. Buscar todos os contatos vinculados a esta pessoa (para ver relacionamentos multi-empresa)
      const { data: allContacts, error: allContactsError } = await supabase
        .from('lead_contacts')
        .select('empresa, tokeniza_investor_id, blue_client_id, updated_at')
        .eq('pessoa_id', contact.pessoa_id);

      if (allContactsError) throw allContactsError;

      // 4. Construir resumo de relacionamentos por empresa
      const relacionamentos: EmpresaRelacionamentoResumo[] = [];
      
      // Agrupar por empresa
      const empresaContacts = allContacts?.reduce((acc, c) => {
        if (!acc[c.empresa]) {
          acc[c.empresa] = [];
        }
        acc[c.empresa].push(c);
        return acc;
      }, {} as Record<string, typeof allContacts>);

      for (const [emp, contacts] of Object.entries(empresaContacts || {})) {
        const ultimaInteracao = contacts.reduce((latest, c) => {
          return c.updated_at > latest ? c.updated_at : latest;
        }, contacts[0].updated_at);

        let tipoRelacao: PessoaRelacaoTipo = 'DESCONHECIDO';
        
        if (emp === 'BLUE') {
          const hasClient = contacts.some(c => c.blue_client_id);
          tipoRelacao = hasClient ? 'CLIENTE_IR' : 'LEAD_IR';
        } else if (emp === 'TOKENIZA') {
          const hasInvestor = contacts.some(c => c.tokeniza_investor_id);
          tipoRelacao = hasInvestor ? 'INVESTIDOR' : 'LEAD_INVESTIDOR';
        }

        relacionamentos.push({
          empresa: emp as 'TOKENIZA' | 'BLUE',
          tipo_relacao: tipoRelacao,
          ultima_interacao_em: ultimaInteracao,
          total_mensagens: undefined, // Poderia ser calculado se necessário
        });
      }

      return {
        pessoa: pessoa as Pessoa,
        relacionamentos,
      };
    },
    enabled: enabled && !!leadId && !!empresa,
  });
}
