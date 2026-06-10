export interface Alert {
  id?: string;
  user_id?: string;
  origem: string;
  destino: string;
  data_ida: string;
  data_volta?: string | null;
  meta: number;
  horario_minimo?: string | null;
  so_direto: boolean;
  whatsapp: string;
  ativo: boolean;
  criado_em?: string;
}

export type AlertCreate = Omit<Alert, 'id' | 'user_id' | 'criado_em'>;
