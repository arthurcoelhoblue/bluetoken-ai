## Plano: Integração Stripe + Assinaturas + Controle de Usuários no Amélia CRM

### Contexto

Baseado no modelo do **LP com IA**, vamos criar um sistema de assinaturas para comercializar o Amélia CRM como **SaaS B2B**. O modelo é **híbrido**: licença base do sistema (com 1 usuário incluso) + licença adicional por usuário.

---

### Arquitetura Geral

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Landing Page    │────▶│  Stripe Checkout  │────▶│  Stripe Webhook │
│  (seção Planos)  │     │  (Edge Function)  │     │  (Edge Function)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                    ┌──────▼──────┐
                                                    │ subscriptions│
                                                    │   (tabela)   │
                                                    └──────┬──────┘
                                                           │
                                              ┌────────────▼────────────┐
                                              │  Controle de limites    │
                                              │  (users por empresa)    │
                                              └─────────────────────────┘
```

---

### 1. Banco de Dados — Novas Tabelas

**Tabela `subscriptions**`

- `id` UUID PK
- `empresa` empresa_tipo (vincula ao tenant)
- `plan` enum (`starter`, `pro`, `business`, `enterprise`)
- `status` enum (`active`, `cancelled`, `past_due`, `trialing`)
- `stripe_customer_id` text
- `stripe_subscription_id` text
- `monthly_price` numeric
- `user_limit` int (quantos usuários inclusos)
- `extra_user_price` numeric (preço por usuário adicional)
- `current_period_start` / `current_period_end` timestamptz
- `created_at`, `updated_at`
- UNIQUE on `empresa`

**Tabela `system_settings**` (reutilizável)

- Para armazenar preços e limites dos planos de forma dinâmica (keys: `pricing`, `plan_limits`)

**RLS**: Leitura pela empresa autenticada; escrita apenas via service_role (webhook).

---

### 2. Edge Functions (3 novas)

`**stripe-checkout**` — Cria sessão de checkout

- Recebe `empresa`, `planId`, URLs de retorno
- Busca config de planos em `system_settings`
- Cria/reutiliza customer no Stripe
- Retorna URL do checkout

`**stripe-webhook**` — Processa eventos do Stripe

- `checkout.session.completed` → ativa assinatura + define limites
- `customer.subscription.updated` → atualiza status/período
- `customer.subscription.deleted` → rebaixa para free
- `invoice.payment_failed` → marca `past_due`
- `invoice.paid` → reativa

`**stripe-portal**` — Abre portal de gerenciamento Stripe

- Autentica usuário, cria sessão do billing portal

`**get-public-plans**` — Retorna planos e preços públicos

- Para exibir na landing page sem autenticação

---

### 3. Frontend

**Landing Page — Seção de Planos**

- Nova seção na LandingPage com cards dos planos
- Preços carregados via `get-public-plans`
- CTA redireciona para checkout ou `/auth` se não logado

**Página `/assinatura**` (nova, protegida)

- Exibe plano atual da empresa, status, período
- Barras de uso (usuários ativos vs. limite)
- Botão "Gerenciar Assinatura" → Stripe Portal
- Botão "Fazer Upgrade" → Stripe Checkout

**Hook `useSubscriptionLimits**`

- Busca `subscriptions` pela empresa ativa
- Conta usuários ativos em `profiles` para a empresa
- Expõe `checkLimit('users')` para verificar antes de criar novos usuários
- Integrado na criação de usuários (`admin-create-user`)

**Bloqueio de criação de usuário**

- Ao tentar criar usuário, verifica se `activeUsers < userLimit`
- Se exceder, exibe modal de upgrade

---

### 4. Planos Sugeridos (configuráveis via system_settings)


| Plano       | Preço/mês | Usuários inclusos | Usuário extra |
| ----------- | --------- | ----------------- | ------------- |
| Amélia Full | R$ 999    | 1                 | R$ 180/mês    |
| &nbsp;      | &nbsp;    | &nbsp;            | &nbsp;        |
| &nbsp;      | &nbsp;    | &nbsp;            | &nbsp;        |
| &nbsp;      | &nbsp;    | &nbsp;            | &nbsp;        |


*Valores são apenas sugestões iniciais, totalmente editáveis.*

---

### 5. Secrets Necessários

- `**STRIPE_SECRET_KEY**` — Chave secreta do Stripe
- `**STRIPE_WEBHOOK_SECRET**` — Secret do webhook para validação de assinatura

---

### 6. Ordem de Implementação

1. Configurar secrets do Stripe
2. Criar tabelas (`subscriptions`, `system_settings`) via migration
3. Criar as 4 edge functions
4. Criar página `/assinatura` e hook `useSubscriptionLimits`
5. Adicionar seção de planos na Landing Page
6. Integrar verificação de limite na criação de usuários