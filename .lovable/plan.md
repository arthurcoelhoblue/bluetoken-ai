## Plano: Importar leads do CSV e criar Edge Function para integração LP com IA

### Análise do CSV

O CSV tem 61 linhas de dados com **duas versões de formulário** (colunas diferentes):

- **Versão 1** (linhas 2-32): nome em `nome`, email em `email`, telefone em `telefone`
- **Versão 2** (linhas 33+): nome em `nome_completo`, email em `e-mail`, telefone em `telefone_/_whatsapp`

Muitas linhas são **testes** (Leonardo/tleonardo186, Halison/halisonhenrique, Tayara, Mychel, Teste Pipedrive). Os leads reais únicos (por email) são aproximadamente **15 pessoas**: Alex Silva, Helder Medeiros, Ivanilde Lima, Celso, João Pedro, Marco, Paulo Rodrigues, RR fer, Ricardo Merrighi, Marcio Galeno, Alberto Oliveira, Cleber Ponce, Edvaldo, Ellen, Giovani Hecke.

Dados adicionais disponíveis por lead: tags (investidor/nao_investidor), UTMs (source, medium, campaign, content, term), interesse, referrer, campos personalizados (campo_1 = plataforma cripto, campo_2 = valor investido).

### Ação imediata: importar este CSV

Criar uma Edge Function `lp-lead-ingest` que:

1. **Aceita um array de leads** no formato LP com IA (campos unificados: nome, email, telefone, tags, utm_*, campos extras)
2. **Filtra testes**: ignora emails conhecidos de teste (tleonardo186, tayara.r.araujo, halisonhenrique, halison@hh, mychel.souza, mychel@blue, teste@pipedrive)
3. **Deduplicação por email**: se já existe contato TOKENIZA com mesmo email, reutiliza; se já tem deal aberto no pipeline Ofertas Públicas, pula
4. **Cria contato**: nome, email, telefone, tags (investidor/nao_investidor + campanha), canal_origem = 'LP_COM_IA'
5. **Cria deal**: pipeline Ofertas Públicas (`5bbac98b`), stage Lead (`da80e912`), título "Nome [Campanha]", temperatura FRIO, owner via round-robin entre vendedores TOKENIZA
6. **Salva UTMs e dados extras** em `metadata_extra` do deal

### Destino

- Pipeline: **Ofertas Públicas** (`5bbac98b-5ae9-4b31-9b7f-896d7b732a2c`)
- Stage: **Lead** (`da80e912-b462-401d-b367-1b6a9b2ec4da`) — primeira etapa
- Vendedores round-robin: Renato Gallucci

### Estrutura para futura integração LP com IA

A Edge Function será o endpoint permanente que o LP com IA vai chamar via webhook a cada novo lead capturado, com payload:

```json
{
  "empresa": "TOKENIZA",
  "pipeline_id": "...",  // opcional, default Ofertas Públicas
  "lead": {
    "nome": "Alex Silva",
    "email": "alex@email.com",
    "telefone": "+351932477665",
    "tags": ["investidor"],
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "...",
    "campos_extras": { "plataforma": "Binance", "valor": "100mil" }
  }
}
```

### Arquivos

1. `supabase/functions/lp-lead-ingest/index.ts` — nova Edge Function
2. Após deploy, chamar a função com os ~15 leads reais extraídos do CSV

### Nenhuma mudança no banco de dados

Tabelas `contacts` e `deals` já têm todos os campos necessários.