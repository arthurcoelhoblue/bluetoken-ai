

## Diagnóstico: Elementor falhou ao enviar lead

### Causa raiz

O mapeamento do formulário `direito_digital` na tabela `elementor_form_mappings` está com os valores do `field_map` **incorretos**. Alguém salvou os shortcodes do Elementor em vez dos IDs puros dos campos:

| Campo | Valor salvo (errado) | Valor correto |
|-------|---------------------|---------------|
| nome | `[field id="name"]` | `name` |
| email | `[field id="email"]` | `email` |
| telefone | `[field id="phone"]` | `phone` |

O Elementor enviou o payload com `fields.name.value`, `fields.email.value`, `fields.phone.value` — mas o código tentou encontrar `fields["[field id=\"name\"]"]`, que não existe. Resultado: nenhum campo principal foi extraído, e a função retornou **422** ("Could not extract lead data").

### Plano de correção

**1. Corrigir o mapeamento no banco** (migration SQL):
```sql
UPDATE elementor_form_mappings
SET field_map = '{"nome": "name", "email": "email", "telefone": "phone"}'::jsonb
WHERE form_id = 'direito_digital';
```

**2. Adicionar logging nas respostas de erro** em `elementor-webhook/index.ts` para facilitar debugging futuro:
- Log antes de retornar 404 (mapping not found)
- Log antes de retornar 422 (could not extract)
- Log antes de retornar 401 (token inválido)

Isso vai evitar que erros futuros fiquem "invisíveis" nos logs.

### Arquivos afetados
- Migration SQL (corrigir field_map)
- `supabase/functions/elementor-webhook/index.ts` (adicionar logs de erro)

