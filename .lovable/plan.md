

# Itens de Producao -- 3 Acoes Finais

---

## 1. Habilitar Leaked Password Protection

Usar a ferramenta `configure-auth` para ativar a protecao contra senhas vazadas (HaveIBeenPwned). Isso impede que usuarios cadastrem senhas ja comprometidas em vazamentos de dados.

**Acao:** Configurar via ferramenta de auth do Lovable Cloud.

---

## 2. Sanitizar EmailPreviewDialog (XSS)

O `TemplateFormDialog` ja foi corrigido (usa React elements, sem `dangerouslySetInnerHTML`). Porem, o `EmailPreviewDialog` ainda usa `doc.write(htmlContent)` diretamente num iframe, o que e um vetor de XSS.

**Correcao:** Adicionar sanitizacao do HTML antes de injetar no iframe, usando uma funcao de escape ou removendo tags perigosas (`<script>`, event handlers). O iframe ja tem `sandbox="allow-same-origin"` (sem `allow-scripts`), o que mitiga scripts, mas e melhor sanitizar no lado do React tambem como defesa em profundidade.

**Arquivo:** `src/components/messages/EmailPreviewDialog.tsx`

**Mudanca:**
- Criar funcao `sanitizeHtml()` que remove `<script>`, `<iframe>`, event handlers (`on*=`), e `javascript:` URLs
- Aplicar antes do `doc.write()`

Alem disso, atualizar o finding `xss_template_preview` para deletar (ja corrigido) ou atualizar para apontar ao EmailPreviewDialog.

---

## 3. Marcar Findings de Visibilidade como Aceitos

Os 3 findings de visibilidade interna (profiles, deals, cs_customers) serao marcados como ignorados com justificativa de que a visibilidade company-wide e intencional no contexto CRM.

**Findings a ignorar:**
- `profiles_table_public_exposure` -- Visibilidade entre colegas e intencional
- `deals_table_financial_exposure` -- CRM requer visibilidade de pipeline para equipe
- `cs_customers_health_scores` -- CS team precisa de visibilidade compartilhada

---

## Resumo Tecnico

| Item | Arquivo/Ferramenta | Tipo |
|------|-------------------|------|
| Leaked password protection | Auth config tool | Configuracao |
| Sanitizar EmailPreviewDialog | `src/components/messages/EmailPreviewDialog.tsx` | Edicao |
| Deletar finding stale XSS | Security findings | Atualizacao |
| Marcar 3 findings como aceitos | Security findings | Atualizacao |

Total: 1 arquivo editado + 1 configuracao de auth + 4 operacoes em findings de seguranca.

