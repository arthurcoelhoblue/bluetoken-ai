

# Reprocessar sync completo desde a página 0

## Estado atual
- **1,040 investidores** na API (com positions)
- **1,077 cs_contracts** criados (pages 0-5 = 300 investidores processados)
- **740 investidores** ficaram sem processar (pages 6-20)
- O orchestrator parou no page 6 (provavelmente timeout na chain)

## Plano

### 1. Disparar o orchestrator desde a página 0
Chamar `tokeniza-gov-sync-orchestrator` com `{ start_page: 0 }` para reprocessar tudo. Como o sync usa **upsert** (`ON CONFLICT`), os registros existentes serão atualizados e os novos criados sem duplicação.

### 2. Validar resultado final
Após ~7 minutos (20 páginas x ~20s cada), verificar:
- Total de `cs_contracts` para TOKENIZA
- Dados do Edgar Luiz Condé especificamente

### Detalhes técnicos
- O upsert em `cs_contracts` usa constraint `(customer_id, ano_fiscal, oferta_id)` — seguro para re-rodar
- O upsert em `cs_customers` usa constraint `(contact_id, empresa)` — seguro para re-rodar
- Contacts são checados por `cpf + empresa` — seguro para re-rodar

