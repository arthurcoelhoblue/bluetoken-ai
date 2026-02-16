/**
 * Mock helpers para Supabase Client
 * Facilita a criação de mocks consistentes para testes
 */

import { vi, type Mock } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = Mock<(...args: any[]) => any>;

export interface MockSupabaseClient {
  from: MockFn;
  auth: {
    getSession: MockFn;
    getUser: MockFn;
    signInWithOAuth: MockFn;
    signOut: MockFn;
  };
  rpc: MockFn;
  storage: {
    from: MockFn;
  };
}

/**
 * Cria um mock básico do Supabase Client
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const mockClient: MockSupabaseClient = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      containedBy: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })) as MockFn,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) as MockFn,
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) as MockFn,
      signInWithOAuth: vi.fn().mockResolvedValue({ data: null, error: null }) as MockFn,
      signOut: vi.fn().mockResolvedValue({ error: null }) as MockFn,
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }) as MockFn,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
      })) as MockFn,
    },
  };

  return mockClient;
}

/**
 * Helper para mockar uma resposta de sucesso do Supabase
 */
export function mockSupabaseSuccess<T>(data: T) {
  return {
    data,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  };
}

/**
 * Helper para mockar uma resposta de erro do Supabase
 */
export function mockSupabaseError(message: string, code = 'PGRST116') {
  return {
    data: null,
    error: {
      message,
      code,
      details: '',
      hint: '',
    },
    count: null,
    status: 400,
    statusText: 'Bad Request',
  };
}

/**
 * Mock de usuário autenticado
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock de sessão autenticada
 */
export function createMockSession(user = createMockUser()) {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
    user,
  };
}
