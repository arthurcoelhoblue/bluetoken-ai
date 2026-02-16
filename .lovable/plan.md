

# Corrigir erro CORS que impede as sugestoes de carregar

## Diagnostico

A edge function `next-best-action` funciona perfeitamente (testei e retornou acoes e narrativa com sucesso). O problema e que o **navegador bloqueia a resposta por CORS**.

O arquivo `supabase/functions/_shared/cors.ts` tem uma whitelist de origens permitidas:
- `https://sdrgrupobue.lovable.app` (dominio publicado)
- `https://id-preview--2e625147-f0fa-49c2-9624-dcb7484793c1.lovable.app` (preview antigo)

Porem o preview atual roda em `https://2e625147-f0fa-49c2-9624-dcb7484793c1.lovableproject.com`, que **nao esta na lista**. Quando o origin nao bate, a funcao retorna o primeiro dominio como fallback, e o navegador rejeita a resposta.

Isso afeta **todas as funcoes do frontend** que usam `getCorsHeaders()`, nao apenas o Next Best Action.

## Solucao

Adicionar o dominio `.lovableproject.com` na whitelist de CORS. Em vez de listar cada dominio exato, vou usar uma verificacao mais flexivel que aceita qualquer subdominio do Lovable.

### Arquivo modificado: `supabase/functions/_shared/cors.ts`

Atualizar a logica de `getCorsHeaders` para aceitar origens que terminem com `.lovable.app` ou `.lovableproject.com`, mantendo a seguranca (apenas dominios Lovable sao aceitos).

```text
Antes:
  const ALLOWED_ORIGINS = [
    "https://sdrgrupobue.lovable.app",
    "https://id-preview--2e625147-...lovable.app",
  ];
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

Depois:
  function isAllowedOrigin(origin: string): boolean {
    return origin.endsWith('.lovable.app')
        || origin.endsWith('.lovableproject.com');
  }
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
```

## Impacto

- Corrige o card "Proximo Passo" e qualquer outra funcao que esteja falhando por CORS no preview
- Previne o problema de acontecer novamente caso o dominio de preview mude
- Mantém segurança: apenas domínios Lovable sao aceitos

