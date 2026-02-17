
# Cadastrar Amelia como Vendedora + Tag IA nos Deals + Teste de Abordagem

## Resumo

Registrar a Amelia como usuario do sistema (vendedora sem comissao, gestor = Arthur Coelho), adicionar uma tag visual "Atendimento IA" nos cards do Kanban para deals atendidos pela Amelia, e preparar o fluxo para que a Amelia possa ser dona de deals/leads durante o atendimento automatizado.

---

## 1. Cadastrar a Amelia como usuario

Usar a edge function `admin-create-user` para criar a Amelia com:
- Nome: **Amelia IA**
- Email: amelia@grupoblue.com.br
- Senha temporaria (sera definida no cadastro)
- `is_vendedor: true` (para aparecer em filtros de dono no Kanban)
- `gestor_id`: Arthur Coelho (`3eb15a6a-9856-4e21-a856-b87eeff933b1`)
- Empresa: `BLUE` (com possibilidade de adicionar TOKENIZA depois)
- Sem comissao (nenhuma regra de comissao sera criada para ela)

Isso sera feito via chamada a edge function existente -- nao precisa de mudancas de codigo.

## 2. Tag visual "Atendimento IA" no DealCard

A tabela `deals` ja possui a coluna `etiqueta` (text) e `tags` (text[]). Vamos usar o campo `etiqueta` para exibir visualmente no card do Kanban.

### Mudancas no `DealCard.tsx`:
- Adicionar renderizacao da `etiqueta` quando presente
- Usar uma Badge com icone de Bot para deals com etiqueta "Amelia IA" ou "Atendimento IA"
- Estilizacao diferenciada (cor roxa/violeta) para tags de IA

```
Antes:
[QUENTE] Deal Titulo
Arthur Coelho
R$ 5.000

Depois:
[QUENTE] [Bot Amelia IA]
Deal Titulo
Arthur Coelho
R$ 5.000
```

### Mudancas no `DealCard.tsx` (tecnico):
- Verificar `deal.etiqueta` e renderizar uma Badge adicional
- Se `etiqueta` contem "IA" ou "Amelia", usar icone Bot + cor diferenciada
- Caso contrario, renderizar como tag generica

## 3. Configurar o deal de teste

Inserir dados no banco para simular o cenario:
- Criar um deal no Pipeline Comercial da BLUE, stage MQL (`7e6ee75a-8efd-4cc4-8264-534bf77993c7`)
- Contact: Arthur Coelho (`d3c63553-497d-4e5c-96d0-12c43893b8f4`)
- Owner: Amelia (apos criacao do usuario)
- Etiqueta: "Atendimento IA"
- Temperatura: FRIO (MQL padrao)

## 4. Fluxo futuro (nao implementado agora, apenas preparado)

A arquitetura permite que:
- Quando a Amelia iniciar um atendimento via SDR, o deal criado automaticamente tera `owner_id = amelia_id` e `etiqueta = 'Atendimento IA'`
- Quando o closer assumir (takeover), o `owner_id` muda para o closer e a `etiqueta` e removida
- O gestor (Arthur) monitora todos os deals da Amelia filtrando por dono no Kanban

---

## Arquivos a modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/components/pipeline/DealCard.tsx` | Editar | Renderizar `etiqueta` como Badge visual |
| `src/types/deal.ts` | Verificar | `etiqueta` ja existe no tipo `Deal` |

## Dados a inserir (via ferramentas do sistema)

1. Criar usuario Amelia via `admin-create-user`
2. Inserir deal de teste no Pipeline Comercial BLUE, stage MQL, com etiqueta "Atendimento IA"

---

## Detalhes tecnicos

### Badge de etiqueta no DealCard

```typescript
// Dentro do DealCard, apos o Badge de temperatura/status
{deal.etiqueta && (
  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
    deal.etiqueta.toLowerCase().includes('ia') || deal.etiqueta.toLowerCase().includes('amelia')
      ? 'bg-violet-500/15 text-violet-600 border-violet-500/30'
      : 'bg-blue-500/15 text-blue-600 border-blue-500/30'
  }`}>
    {deal.etiqueta.toLowerCase().includes('ia') && <Bot className="h-3 w-3 mr-0.5" />}
    {deal.etiqueta}
  </Badge>
)}
```

### Criacao do usuario Amelia

Chamada a `admin-create-user` com body:
```json
{
  "email": "amelia@grupoblue.com.br",
  "nome": "Amélia IA",
  "password": "AmeliaGrupoBlue2025!",
  "gestor_id": "3eb15a6a-9856-4e21-a856-b87eeff933b1",
  "is_vendedor": true,
  "empresa": "BLUE"
}
```

### Deal de teste

```sql
INSERT INTO deals (contact_id, pipeline_id, stage_id, titulo, valor, temperatura, owner_id, etiqueta, posicao_kanban)
VALUES (
  'd3c63553-497d-4e5c-96d0-12c43893b8f4',
  '21e577cc-32eb-4f1c-895e-b11bfc056e99',
  '7e6ee75a-8efd-4cc4-8264-534bf77993c7',
  'Arthur Coelho - Blue Consult (MQL)',
  0,
  'FRIO',
  '<amelia_user_id>',
  'Atendimento IA',
  1
);
```
