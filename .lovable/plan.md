

# Gamificacao com Consequencia (8.2)

## Diagnostico Atual

O sistema de gamificacao ja possui a infraestrutura basica:

| Componente | Status | Detalhe |
|---|---|---|
| Tabela `seller_badges` | Pronta | 10 badges configurados (streak, fechamento, ranking, atividade) |
| Tabela `seller_badge_awards` | Pronta | Vazia - nenhum badge concedido |
| Tabela `seller_points_log` | Pronta | Vazia - nenhum ponto registrado |
| View `seller_leaderboard` | Pronta | Consolida pontos, badges e streak |
| Funcao `fn_gamify_deal_ganho` | Pronta | Logica completa para pontuar deal ganho + conceder badges |
| **Trigger no deals** | **AUSENTE** | A funcao existe mas nao esta ligada a nenhuma tabela |
| Trigger para atividades | **AUSENTE** | Nada pontua conclusao de tarefas |
| Trigger para streak | **AUSENTE** | Badges de streak nao sao concedidos automaticamente |
| UI Workbench | Pronta | Card resumo no "Meu Dia" |
| UI Metas | Pronta | Aba "Gamificacao" com Leaderboard + Badges |

**Problema central**: O motor de gamificacao esta "desligado" -- a funcao de pontuacao existe mas nunca e chamada porque falta o trigger no `deals`. Alem disso, nao ha gatilhos para atividades concluidas, streak de badges, nem feedback visual ao usuario quando ganha pontos/badges.

## Plano de Implementacao

### 1. Ativar trigger de deal ganho (DB)

Criar o trigger que conecta `fn_gamify_deal_ganho` a tabela `deals`:

```sql
CREATE TRIGGER trg_gamify_deal_ganho
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_deal_ganho();
```

### 2. Criar funcao e trigger para atividades concluidas (DB)

Nova funcao `fn_gamify_activity_done` que:
- Ao marcar `tarefa_concluida = true` em `deal_activities`, concede pontos (5 pts por tarefa)
- Verifica threshold de 50 atividades na semana para badge `activity_50`

```sql
CREATE OR REPLACE FUNCTION fn_gamify_activity_done()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_empresa text;
  v_week_count int;
BEGIN
  IF NEW.tarefa_concluida = true AND (OLD.tarefa_concluida IS DISTINCT FROM true) AND NEW.user_id IS NOT NULL THEN
    -- Descobrir empresa via deal -> contact
    SELECT c.empresa::text INTO v_empresa
    FROM deals d JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = NEW.deal_id;
    IF v_empresa IS NULL THEN v_empresa := 'BLUE'; END IF;

    -- Pontuar
    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.user_id, v_empresa, 5, 'TAREFA_CONCLUIDA', NEW.id::text);

    -- Badge activity_50
    SELECT COUNT(*) INTO v_week_count
    FROM deal_activities
    WHERE user_id = NEW.user_id AND tarefa_concluida = true
      AND created_at >= date_trunc('week', now());
    IF v_week_count >= 50 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.user_id, 'activity_50', v_empresa, to_char(now(), 'IYYY-IW'))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_gamify_activity_done
  AFTER UPDATE ON deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_activity_done();
```

### 3. Criar funcao e trigger para streak de badges (DB)

Nova funcao `fn_gamify_streak_check` executada apos insercao de pontos para verificar streak:

```sql
CREATE OR REPLACE FUNCTION fn_gamify_streak_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_streak int;
BEGIN
  -- Contar dias distintos com pontos nos ultimos 30 dias
  SELECT COUNT(DISTINCT created_at::date) INTO v_streak
  FROM seller_points_log
  WHERE user_id = NEW.user_id AND empresa = NEW.empresa
    AND created_at >= now() - interval '30 days';

  IF v_streak >= 3 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_3', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;
  IF v_streak >= 7 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_7', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;
  IF v_streak >= 30 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_30', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_gamify_streak_check
  AFTER INSERT ON seller_points_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_streak_check();
```

### 4. Notificacao visual de conquista (Frontend)

Adicionar um componente `GamificationToast` que mostra uma notificacao animada quando o usuario ganha pontos ou um badge. Implementar via Realtime subscription no `seller_points_log` e `seller_badge_awards`.

- Habilitar realtime nas tabelas `seller_points_log` e `seller_badge_awards`
- Criar hook `useGamificationNotifications` que escuta inserts em tempo real
- Mostrar toast estilizado com icone do badge e pontos ganhos
- Integrar no `AppLayout` para funcionar em qualquer pagina

### 5. Historico de pontos na aba Gamificacao (Frontend)

Enriquecer a aba "Gamificacao" na pagina de Metas com:
- Feed de atividade recente (ultimos pontos ganhos) usando `useRecentAwards`
- Mostrar tipo da acao, pontos, e data

---

## Detalhes Tecnicos

### Migracao SQL (1 migracao)

| Acao | Descricao |
|---|---|
| `CREATE TRIGGER trg_gamify_deal_ganho` | Conecta funcao existente ao deals |
| `CREATE FUNCTION fn_gamify_activity_done` | Pontua tarefas concluidas + badge atividade |
| `CREATE TRIGGER trg_gamify_activity_done` | Liga funcao ao deal_activities |
| `CREATE FUNCTION fn_gamify_streak_check` | Verifica e concede badges de streak |
| `CREATE TRIGGER trg_gamify_streak_check` | Liga funcao ao seller_points_log |
| `ALTER PUBLICATION supabase_realtime ADD TABLE seller_points_log, seller_badge_awards` | Habilitar realtime |

### Arquivos Frontend

| Arquivo | Acao |
|---|---|
| `src/hooks/useGamificationNotifications.ts` | **Novo** - Realtime listener para pontos e badges |
| `src/components/gamification/GamificationToast.tsx` | **Novo** - Toast animado de conquista |
| `src/components/layout/AppLayout.tsx` | **Editar** - Integrar listener de gamificacao |
| `src/pages/MetasPage.tsx` | **Editar** - Adicionar feed de atividade recente na aba Gamificacao |

### Tabela de pontuacao

| Evento | Pontos | Badge Possivel |
|---|---|---|
| Deal ganho | max(10, valor/1000) | first_deal, deal_10, deal_50 |
| Tarefa concluida | 5 | activity_50 (50/semana) |
| Streak 3 dias | -- | streak_3 |
| Streak 7 dias | -- | streak_7 |
| Streak 30 dias | -- | streak_30 |
| Meta 100% | -- | meta_100 (verificacao futura) |
| Meta 150% | -- | meta_150 (verificacao futura) |
| #1 ranking | -- | top_month (verificacao futura) |

### Fluxo de dados

```text
Deal marcado GANHO
    |
    v
trg_gamify_deal_ganho (trigger)
    |
    +-- INSERT seller_points_log (10+ pts)
    +-- INSERT seller_badge_awards (first_deal/deal_10/deal_50)
    |
    v
trg_gamify_streak_check (trigger cascata)
    |
    +-- Verifica dias distintos com pontos
    +-- INSERT seller_badge_awards (streak_3/7/30)
    |
    v
Realtime -> useGamificationNotifications
    |
    v
GamificationToast (UI)
```

