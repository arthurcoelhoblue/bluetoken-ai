

# Limpeza: Remover referencia morta ao LOVABLE_API_KEY no sdr-ia-interpret

## Contexto

A auditoria identificou que o `sdr-ia-interpret` ainda referenciava o `LOVABLE_API_KEY`. Porem, ao ler o codigo linha a linha, o cenario real e:

- **Linha 2720**: Comentario explicito `tryLovableAI removido -- PATCH Auditoria V2: todas as chamadas IA usam Anthropic ou Google Direct`
- **Linhas 2614-2718**: Apenas `tryAnthropic()` e `tryGoogleDirect()` existem como provedores
- **Linhas 2740-2758**: O fallback loop so chama Anthropic e Google Direct
- **Linhas 2085-2088**: Unico problema -- verificacao morta do `LOVABLE_API_KEY` que nunca e usada

## O que sera feito

Remover as 4 linhas mortas (2085-2088) que verificam `LOVABLE_API_KEY` sem nunca usa-la. Isso elimina:

1. Codigo morto que confunde auditorias futuras
2. Um `throw` desnecessario caso o secret fosse removido (embora seja auto-provisionado)

## Alteracao unica

**Arquivo**: `supabase/functions/sdr-ia-interpret/index.ts`

**Remover** (linhas 2085-2088):
```text
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
if (!LOVABLE_API_KEY) {
  throw new Error('LOVABLE_API_KEY nao configurada');
}
```

Nenhum outro arquivo precisa ser alterado. Nenhuma migracao SQL necessaria.

## Secao Tecnica

| Item | Detalhe |
|------|---------|
| Arquivo | `supabase/functions/sdr-ia-interpret/index.ts` |
| Linhas afetadas | 2085-2088 (4 linhas removidas) |
| Risco | Zero -- codigo morto, nenhuma funcao referencia a variavel |
| Deploy | Automatico apos salvar |

