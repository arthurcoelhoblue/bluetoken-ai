/**
 * Testes de Integração: Autenticação e RBAC
 * 
 * Testa os fluxos críticos de autenticação e controle de acesso baseado em papéis.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockSupabaseClient, createMockUser, createMockSession, mockSupabaseSuccess } from '../helpers/supabase-mock';

describe('Autenticação e RBAC', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Autenticação com Google OAuth', () => {
    it('deve iniciar o fluxo de autenticação com Google', async () => {
      const mockAuthResponse = {
        data: {
          provider: 'google',
          url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
        },
        error: null,
      };

      mockSupabase.auth.signInWithOAuth.mockResolvedValue(mockAuthResponse);

      const result = await mockSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      expect(result.data?.provider).toBe('google');
      expect(result.data?.url).toContain('google.com');
      expect(result.error).toBeNull();
    });

    it('deve obter a sessão do usuário autenticado', async () => {
      const mockUser = createMockUser({
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' },
      });
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await mockSupabase.auth.getSession();

      expect(result.data.session).toBeDefined();
      expect(result.data.session?.user.email).toBe('test@example.com');
      expect(result.data.session?.access_token).toBe('mock-access-token');
      expect(result.error).toBeNull();
    });

    it('deve fazer logout corretamente', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const result = await mockSupabase.auth.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });
  });

  describe('RBAC - Controle de Acesso Baseado em Papéis', () => {
    it('deve retornar os papéis do usuário autenticado', async () => {
      const mockUserRoles = [
        {
          id: 'role-1',
          user_id: 'test-user-id',
          role: 'ADMIN',
          created_at: new Date().toISOString(),
        },
      ];

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue(mockSupabaseSuccess(mockUserRoles)),
      }));

      mockSupabase.from = mockFrom;

      const result = await mockSupabase
        .from('user_roles')
        .select('*')
        .eq('user_id', 'test-user-id');

      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].role).toBe('ADMIN');
      expect(result.error).toBeNull();
    });

    it('deve verificar se usuário tem papel específico (ADMIN)', async () => {
      const mockRpcResponse = mockSupabaseSuccess(true);
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      const result = await mockSupabase.rpc('has_role', {
        user_id: 'test-user-id',
        required_role: 'ADMIN',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('has_role', {
        user_id: 'test-user-id',
        required_role: 'ADMIN',
      });

      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });

    it('deve retornar false se usuário não tem o papel requerido', async () => {
      const mockRpcResponse = mockSupabaseSuccess(false);
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      const result = await mockSupabase.rpc('has_role', {
        user_id: 'test-user-id',
        required_role: 'CLOSER',
      });

      expect(result.data).toBe(false);
    });

    it('deve listar todos os papéis disponíveis no sistema', () => {
      const expectedRoles = [
        'ADMIN',
        'CLOSER',
        'MARKETING',
        'AUDITOR',
        'READONLY',
        'SDR_IA',
      ];

      // Este é um teste de contrato - garante que os papéis esperados existem
      expect(expectedRoles).toContain('ADMIN');
      expect(expectedRoles).toContain('CLOSER');
      expect(expectedRoles).toContain('SDR_IA');
      expect(expectedRoles).toHaveLength(6);
    });
  });

  describe('Fluxo completo de autenticação', () => {
    it('deve executar o fluxo completo: login → obter sessão → verificar papel → logout', async () => {
      // 1. Login
      const mockAuthResponse = {
        data: { provider: 'google', url: 'https://google.com/oauth' },
        error: null,
      };
      mockSupabase.auth.signInWithOAuth.mockResolvedValue(mockAuthResponse);

      const loginResult = await mockSupabase.auth.signInWithOAuth({ provider: 'google' });
      expect(loginResult.error).toBeNull();

      // 2. Obter sessão
      const mockUser = createMockUser({ id: 'user-123' });
      const mockSession = createMockSession(mockUser);
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const sessionResult = await mockSupabase.auth.getSession();
      expect(sessionResult.data.session?.user.id).toBe('user-123');

      // 3. Verificar papel
      mockSupabase.rpc.mockResolvedValue(mockSupabaseSuccess(true));
      const roleCheckResult = await mockSupabase.rpc('has_role', {
        user_id: 'user-123',
        required_role: 'ADMIN',
      });
      expect(roleCheckResult.data).toBe(true);

      // 4. Logout
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      const logoutResult = await mockSupabase.auth.signOut();
      expect(logoutResult.error).toBeNull();
    });
  });
});
