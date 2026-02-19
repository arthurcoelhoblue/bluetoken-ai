

# Plano: Adicionar debug logging ao backfill

## Problema
O backfill rodou com sucesso (50 contatos processados) mas todos retornaram "sem_investimentos". O SGT encontra o lead (nao retorna erro), porem o campo `lead.dados_tokeniza?.investimentos` esta vazio ou inexistente. Precisamos ver a estrutura real da resposta.

## Solucao
Adicionar log de debug no `sgt-backfill-investimentos` para registrar a estrutura da resposta do SGT nos primeiros 3 contatos do batch. Isso nos mostrara exatamente onde estao os dados de investimentos.

## Alteracao

No arquivo `supabase/functions/sgt-backfill-investimentos/index.ts`, apos a linha que faz o unwrap do lead (linha ~178), adicionar um log que mostra:
- As chaves do objeto `lead`
- As chaves de `lead.dados_tokeniza` (se existir)
- Se existe `lead.investimentos` diretamente no lead

Limitar o log aos primeiros 3 contatos para nao poluir os logs.

### Detalhe tecnico

```text
// Apos extrair o lead, logar a estrutura (apenas primeiros 3)
if (detalhes.length < 3) {
  log.info(`DEBUG lead keys para ${contact.nome}`, {
    lead_keys: Object.keys(lead),
    has_dados_tokeniza: !!lead.dados_tokeniza,
    dados_tokeniza_keys: lead.dados_tokeniza ? Object.keys(lead.dados_tokeniza) : null,
    has_investimentos_direct: !!lead.investimentos,
    has_tokeniza_investimentos: !!lead.tokeniza_investimentos,
  });
}
```

Apos o deploy, rodar o backfill novamente (com reset de offset) e verificar os logs para identificar o caminho correto dos dados.

