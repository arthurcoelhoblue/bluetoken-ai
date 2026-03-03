

## Diagnóstico: Templates indisponíveis para +34664572190

### Situação atual

| Conexão | Número | Templates sincronizados | Aprovados |
|---------|--------|------------------------|-----------|
| Comercial BR | +5561995262818 | 1 (clonado) | 1 |
| Comercial EUR | +34664572190 | **0** | **0** |
| Sem conexão (legado) | — | 14 | 6 |

O problema tem duas camadas:

1. **Nenhum template foi sincronizado** para a conexão EUR (`53aeb5e8`). Os 6 templates aprovados da TOKENIZA estão "órfãos" (sem `connection_id`), pertencendo à WABA antiga.

2. **O filtro atual é muito restritivo**: após a correção anterior, o `TemplatePickerDialog` filtra estritamente por `connection_id`, então ao selecionar o número EUR, aparece "Nenhum template aprovado encontrado".

### Solução

**1. Incluir templates legados como fallback na UI**

No `TemplatePickerDialog`, quando uma conexão está selecionada mas não tem templates, também mostrar templates legados (sem `connection_id`) com um badge visual indicando que precisam ser sincronizados/clonados para aquela WABA. Isso permite ao usuário ver o que está disponível e decidir.

Alterar a query para: se `connectionId` está definido, buscar `connection_id = connectionId OR connection_id IS NULL`, mas marcar visualmente quais são legados.

**2. Sincronizar templates no envio**

No `whatsapp-send`, quando recebe um template legado (sem `connection_id`) para enviar por uma conexão específica, tentar enviar com o `codigo` do template. Se a Meta retornar erro 132001 (template não existe), retornar uma mensagem clara: "Este template não foi registrado na WABA deste número. Sincronize os templates primeiro."

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/conversas/TemplatePickerDialog.tsx` | Query inclui templates legados como fallback; badge "Não sincronizado" nos legados |

Essa abordagem permite testar o envio de texto livre por ambos os números imediatamente, e para templates, mostra quais estão disponíveis e quais precisam ser sincronizados na WABA do número EUR via Meta Business Manager.

