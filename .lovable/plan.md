

# Auto-Aprovacao Inteligente de FAQ (com Gemini 3 Pro Preview via API direta)

## Unica mudanca vs plano anterior

Em vez de Lovable AI / gemini-2.5-flash, a edge function `faq-auto-review` usara **Google Gemini 3 Pro Preview** via API direta com `GOOGLE_API_KEY` (ja configurado), seguindo o mesmo padrao das outras 14+ edge functions do projeto.

## Arquivos a criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/faq-auto-review/index.ts` | Edge function que busca FAQs aprovadas + knowledge sections, envia para Gemini 3 Pro Preview comparar, retorna `{ auto_approve, confianca, justificativa }` |

## Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useKnowledgeFaq.ts` | Adicionar funcao `checkFaqAutoApproval` + modificar `useCreateFaq` para aceitar auto-aprovacao com `visivel_amelia: true` |
| `src/components/knowledge/FaqFormDialog.tsx` | Ao clicar "Publicar": verificar ADMIN -> auto-aprovar; senao chamar edge function -> decidir status. Loading state + toasts diferenciados |

## Edge Function: faq-auto-review

Chamada Gemini (mesmo padrao do projeto):

```typescript
const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    }),
  }
);
```

## Logica completa

```text
Usuario clica "Publicar"
    |
    v
[Criador e ADMIN?] --SIM--> APROVADO (auto, sem chamar IA)
    |
   NAO
    |
    v
[Edge: faq-auto-review]
[Gemini 3 Pro Preview compara com base existente]
    |
    v
[confianca >= 85?] --SIM--> APROVADO (auto)
    |
   NAO
    |
    v
PENDENTE (aprovacao do gestor)

Fallback: se edge falhar -> PENDENTE
```

## UX

- Loading spinner no botao enquanto IA analisa (~2-3s)
- Toast "FAQ aprovada automaticamente (admin)" se ADMIN
- Toast "FAQ aprovada automaticamente - conteudo alinhado com a base" se IA aprovou
- Toast "Enviado para aprovacao do gestor" se pendente
