

## Plano: Limpar todas as notificações do banco

### Ação

Executar um `DELETE FROM notifications` para remover todas as 60 notificações existentes (de todos os usuários, todas as empresas).

### Como

Uma única migração SQL:
```sql
DELETE FROM notifications;
```

Nenhuma mudança de código necessária — o sistema continuará criando notificações normalmente a partir de amanhã.

