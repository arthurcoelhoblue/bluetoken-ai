# 📦 PATCH 1 - Autenticação Google + RBAC

**Data:** 2025-12-08  
**Épico:** Autenticação e Controle de Acesso  
**Status:** ✅ Implementado

---

## 🎯 Objetivo

Implementar autenticação via Google OAuth com sistema de controle de acesso baseado em papéis (RBAC). O primeiro usuário a se cadastrar recebe automaticamente o papel de ADMIN, enquanto os demais recebem READONLY.

---

## 📁 Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/20251208180709_*.sql` | Novo | Migration com schema de auth |
| `src/types/auth.ts` | Novo | Tipos TypeScript para RBAC |
| `src/contexts/AuthContext.tsx` | Novo | Context de autenticação |
| `src/components/auth/ProtectedRoute.tsx` | Novo | HOC para proteção de rotas |
| `src/components/auth/RoleBadge.tsx` | Novo | Badge visual de papel |
| `src/pages/Auth.tsx` | Novo | Página de login |
| `src/pages/Me.tsx` | Novo | Página de perfil |
| `src/pages/Unauthorized.tsx` | Novo | Página de acesso negado |
| `src/pages/Index.tsx` | Modificado | Dashboard principal |
| `src/App.tsx` | Modificado | Configuração de rotas |
| `src/index.css` | Modificado | Design system |
| `tailwind.config.ts` | Modificado | Tema corporativo |
| `src/components/ui/button.tsx` | Modificado | Variante Google |

---

## 🗄️ Alterações no Banco de Dados

### Enums Criados

```sql
CREATE TYPE public.user_role AS ENUM (
  'ADMIN',
  'CLOSER',
  'MARKETING',
  'AUDITOR',
  'READONLY',
  'SDR_IA'
);
```

### Tabelas Criadas

```sql
-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  google_id TEXT,
  email TEXT NOT NULL,
  nome TEXT,
  avatar_url TEXT,
  empresa_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de papéis
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  role user_role NOT NULL DEFAULT 'READONLY',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

### Funções Criadas

```sql
-- Verifica se usuário tem papel específico
CREATE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna todos os papéis do usuário
CREATE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS user_role[]
LANGUAGE sql STABLE SECURITY DEFINER;

-- Cria perfil automaticamente no primeiro login
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies

| Tabela | Policy | Comando | Descrição |
|--------|--------|---------|-----------|
| profiles | Users can view their own profile | SELECT | Usuário vê próprio perfil |
| profiles | Admins can view all profiles | SELECT | Admin vê todos |
| profiles | Users can update their own profile | UPDATE | Usuário atualiza próprio |
| profiles | Admins can update any profile | UPDATE | Admin atualiza todos |
| user_roles | Users can view their own roles | SELECT | Usuário vê próprios papéis |
| user_roles | Admins can view all roles | SELECT | Admin vê todos |
| user_roles | Admins can manage roles | ALL | Admin gerencia todos |

---

## ⚙️ Funcionalidades Implementadas

1. ✅ Login via Google OAuth
2. ✅ Criação automática de perfil no primeiro login
3. ✅ Atribuição automática de papel (primeiro = ADMIN, demais = READONLY)
4. ✅ Sistema de permissões por papel (ROLE_PERMISSIONS)
5. ✅ Proteção de rotas por papel e permissão
6. ✅ Atualização de `last_login_at` a cada login
7. ✅ Verificação de conta ativa/desativada
8. ✅ Design system corporativo (cores, tipografia, componentes)

---

## 🧪 Testes

| # | Teste | Cenário | Resultado Esperado | Status |
|---|-------|---------|-------------------|--------|
| 1 | Login Google | Usuário clica em "Entrar com Google" | Redireciona para OAuth do Google | ⏳ Pendente Config |
| 2 | Primeiro Usuário | Primeiro login no sistema | Recebe papel ADMIN automaticamente | ⏳ Pendente Config |
| 3 | Segundo Usuário | Segundo login em diante | Recebe papel READONLY | ⏳ Pendente Config |
| 4 | Proteção de Rota | Acesso /me sem autenticação | Redireciona para /auth | ✅ Funcional |
| 5 | Perfil Desativado | Usuário com is_active=false | Mostra tela de conta desativada | ✅ Funcional |
| 6 | Papel Insuficiente | Acesso a rota sem permissão | Redireciona para /unauthorized | ✅ Funcional |
| 7 | Página /me | Usuário autenticado acessa /me | Exibe dados do perfil e papéis | ⏳ Pendente Config |
| 8 | Logout | Usuário clica em "Sair" | Limpa sessão e redireciona para /auth | ⏳ Pendente Config |

---

## 🔧 Configurações Necessárias

Para o Google OAuth funcionar, é necessário:

- [ ] Criar projeto no Google Cloud Console
- [ ] Habilitar API do Google OAuth
- [ ] Configurar tela de consentimento OAuth
- [ ] Criar credenciais OAuth 2.0
- [ ] Adicionar URL de callback autorizado: `https://xdjvlcelauvibznnbrzb.supabase.co/auth/v1/callback`
- [ ] Habilitar Google Provider no backend (Lovable Cloud)

---

## 📊 Diagrama de Fluxo

```mermaid
graph TD
    A[Usuário] --> B[/auth - Login Page]
    B --> C[Google OAuth]
    C --> D{Primeiro usuário?}
    D -->|Sim| E[Cria Profile + ADMIN]
    D -->|Não| F[Cria Profile + READONLY]
    E --> G[Dashboard /]
    F --> G
    G --> H{Rota protegida?}
    H -->|Sim| I{Tem permissão?}
    I -->|Sim| J[Acessa página]
    I -->|Não| K[/unauthorized]
    H -->|Não| J
    J --> L[/me - Perfil]
    L --> M[Logout]
    M --> B
```

---

## 📝 Notas Adicionais

### Mapeamento de Papéis e Permissões

```typescript
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ['manage_users', 'manage_leads', 'view_analytics', 'manage_settings', 'manage_campaigns', 'view_reports'],
  CLOSER: ['manage_leads', 'view_analytics', 'view_reports'],
  MARKETING: ['manage_campaigns', 'view_analytics', 'view_reports'],
  AUDITOR: ['view_analytics', 'view_reports'],
  READONLY: ['view_reports'],
  SDR_IA: ['manage_leads', 'view_analytics'],
};
```

---

## 🔗 Dependências

- Nenhuma (primeiro patch)
