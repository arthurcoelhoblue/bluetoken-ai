export interface Badge {
  id: string;
  key: string;
  nome: string;
  descricao: string | null;
  icone: string;
  categoria: string;
  criterio_valor: number;
  created_at: string;
}

export interface BadgeAward {
  id: string;
  user_id: string;
  badge_key: string;
  empresa: string;
  awarded_at: string;
  referencia: string | null;
}

export interface PointsLog {
  id: string;
  user_id: string;
  empresa: string;
  pontos: number;
  tipo: string;
  referencia_id: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  vendedor_nome: string;
  vendedor_avatar: string | null;
  empresa: string;
  pontos_mes: number;
  total_badges: number;
  streak_dias: number;
  ranking_posicao: number;
}
