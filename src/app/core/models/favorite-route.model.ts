export interface FavoriteRoute {
  id?: string;
  user_id?: string;
  tipo: 'voo' | 'onibus';
  /** Rótulo exibido: IATA ("GRU") em voos, nome da cidade ("Franca") em ônibus. */
  origem: string;
  destino: string;
  /** Identidade da rota: IATA minúsculo em voos, slug da Buser em ônibus. */
  origem_slug: string;
  destino_slug: string;
  meta?: number | null;
  /** Só voos. */
  horario_minimo?: string | null;
  /** Só voos. */
  so_direto: boolean;
  criado_em?: string;
}

export type FavoriteRouteCreate = Omit<FavoriteRoute, 'id' | 'user_id' | 'criado_em'>;
