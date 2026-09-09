import {Injectable} from '@angular/core';
import {createClient, SupabaseClient, User} from '@supabase/supabase-js';
import {environment} from '@env/environment';
import {Alert, AlertCreate} from '@core/models/alert.model';

@Injectable({providedIn: 'root'})
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-client-info': 'vooalerta/1.0'
        }
      }
    });
  }

  // ── Auth ──────────────────────────────────────────────────
  async signUp(email: string, password: string, whatsapp: string, nome: string) {
    return this.client.auth.signUp({
      email,
      password,
      options: {data: {whatsapp, nome}}
    });
  }

  async signIn(email: string, password: string) {
    await this.client.auth.signOut();
    return this.client.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: undefined
      }
    });
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  async getUser(): Promise<User | null> {
    const { data: { session } } = await this.client.auth.getSession();
    return session?.user ?? null;
  }

  isSessionError(error: unknown): boolean {
    if (!error) return false;
    const msg = (error as any)?.message ?? '';
    return msg.includes('JWT') || msg.includes('session') || msg.includes('not authenticated') || msg.includes('Não autenticado');
  }

  onAuthChange(callback: (user: User | null) => void) {
    this.client.auth.onAuthStateChange((_, session) => {
      callback(session?.user ?? null);
    });
  }

  async getProfile() {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: null, error: new Error('Não autenticado') };

    const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    return { data, error };
  }

  async updateProfile(changes: { whatsapp?: string; callmebot_key?: string; nome?: string }) {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: null, error: new Error('Não autenticado') };

    return this.client
        .from('profiles')
        .update(changes)
        .eq('id', session.user.id);
  }

  // Antes eram duas queries identicas (getMinPriceForRoute +
  // getMinPriceLinkForRoute) chamadas sempre em par - mesma tabela, mesmo
  // filtro, mesma ordenacao, so mudando as colunas do select. Unificadas
  // numa so pra cortar pela metade os round-trips ao Supabase (#137).
  async getMinPriceRowForRoute(
    origem: string,
    destino: string,
    dataIda: string,
    dataVolta: string | null = null,
    options: { horarioMinimo?: string | null; soDireto?: boolean } = {}
  ): Promise<{ preco: number | null; link: string | null }> {
    let query = this.client
        .from('price_cache')
        .select('preco, link, horario_partida, escalas')
        .eq('origem', origem)
        .eq('destino', destino)
        .eq('data_ida', dataIda)
        .not('preco', 'is', null);

    query = dataVolta ? query.eq('data_volta', dataVolta) : query.is('data_volta', null);

    const { data } = await query
        .order('preco', { ascending: true })
        .limit(200);

    const horarioMinimo = options.horarioMinimo && options.horarioMinimo !== '00:00'
      ? options.horarioMinimo
      : null;
    const rows = (data ?? [])
      .filter(row => !horarioMinimo || row.horario_partida === null || row.horario_partida >= horarioMinimo)
      .filter(row => !options.soDireto || row.escalas === null || row.escalas === 0)
      .filter((row): row is typeof row & { preco: number } => typeof row.preco === 'number');

    if (rows.length === 0) return { preco: null, link: null };

    const menor = rows.reduce((min, row) => row.preco < min.preco ? row : min);
    return { preco: menor.preco, link: menor.link ?? null };
  }

  async getMinPriceDetailsForRoute(
    origem: string,
    destino: string,
    dataIda: string,
    dataVolta: string | null = null,
    options: { horarioMinimo?: string | null; soDireto?: boolean } = {}
  ): Promise<{ preco: number; companhia: string | null; atualizado_em: string | null } | null> {
    let query = this.client
        .from('price_cache')
        .select('preco, companhia, atualizado_em, horario_partida, escalas')
        .eq('origem', origem)
        .eq('destino', destino)
        .eq('data_ida', dataIda)
        .not('preco', 'is', null);

    query = dataVolta ? query.eq('data_volta', dataVolta) : query.is('data_volta', null);

    const { data } = await query
        .order('preco', { ascending: true })
        .limit(200);

    const horarioMinimo = options.horarioMinimo && options.horarioMinimo !== '00:00'
      ? options.horarioMinimo
      : null;
    const row = (data ?? [])
      .filter(row => !horarioMinimo || row.horario_partida === null || row.horario_partida >= horarioMinimo)
      .filter(row => !options.soDireto || row.escalas === null || row.escalas === 0)
      .find(row => typeof row.preco === 'number');

    if (!row) return null;
    return { preco: row.preco, companhia: row.companhia ?? null, atualizado_em: row.atualizado_em ?? null };
  }

  async enqueueFlightRefresh(origem: string, destino: string, dataIda: string, dataVolta?: string | null): Promise<{ jobId: string | null }> {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { jobId: null };

    try {
      const res = await fetch('/api/scrape-flight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          origem,
          destino,
          data_ida: dataIda,
          data_volta: dataVolta ?? null
        })
      });

      const contentType = res.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (!contentType.includes('application/json') || !res.ok) {
        console.warn('scrape-flight (enqueue) falhou', res.status, data?.error);
        return { jobId: null };
      }

      return { jobId: data?.job_id ?? null };
    } catch (err) {
      console.warn('scrape-flight (enqueue) falhou:', err);
      return { jobId: null };
    }
  }

  async getJobStatus(jobId: string): Promise<{ status: string; preco: number | null; link?: string; warning?: string; error?: string }> {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { status: 'error', preco: null, error: 'Sessão expirada. Faça login novamente.' };

    try {
      const res = await fetch(`/api/job-status?job_id=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store'
      });

      const contentType = res.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      const generic = 'Não foi possível consultar a atualização agora.';

      if (!contentType.includes('application/json') || !res.ok) {
        console.warn('job-status falhou', res.status, data?.error);
        return { status: 'error', preco: null, error: generic };
      }

      return {
        status: data?.status ?? 'error',
        preco: data?.preco ?? null,
        link: data?.link ?? undefined,
        warning: data?.warning ?? undefined,
        error: data?.error ?? undefined
      };
    } catch (err) {
      console.warn('job-status falhou:', err);
      return { status: 'error', preco: null, error: 'Não foi possível consultar a atualização agora.' };
    }
  }

  async getAlerts() {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: [], error: null };

    return this.client
        .from('alerts')
        .select('*')
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('criado_em', { ascending: false });
  }

  async reorderAlerts(orderedIds: string[]) {
    // upsert em lote em vez de um UPDATE por card (#141): so a coluna
    // "ordem" muda, mas upsert exige a linha inteira ou risca sobrescrever
    // as demais colunas com null - por isso le a linha atual antes.
    const { data: existentes, error: fetchError } = await this.client
      .from('alerts')
      .select('*')
      .in('id', orderedIds);

    if (fetchError || !existentes) throw fetchError ?? new Error('Falha ao carregar alertas para reordenar.');

    const porId = new Map(existentes.map(row => [row.id, row]));
    const rows = orderedIds
      .map((id, index) => {
        const row = porId.get(id);
        return row ? { ...row, ordem: index } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const { error } = await this.client.from('alerts').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async createAlert(payload: AlertCreate) {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: null, error: new Error('Não autenticado') };

    return this.client
        .from('alerts')
        .insert({ ...payload, user_id: session.user.id });
  }

  async updateAlert(id: string, changes: Partial<Alert>) {
    return this.client
        .from('alerts')
        .update(changes)
        .eq('id', id);
  }

  async deleteAlert(id: string) {
    return this.client
        .from('alerts')
        .delete()
        .eq('id', id);
  }

  async getAlertById(id: string) {
    return this.client.rpc('get_shared_alert', { alert_id: id });
  }

  subscribePriceCache(callback: () => void) {
    return this.client
      .channel('price-cache-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_cache' }, callback)
      .subscribe();
  }

  // ── Ônibus ────────────────────────────────────────────────────

  async getBusAlerts() {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: [], error: null };

    return this.client
      .from('bus_alerts')
      .select('*')
      .order('criado_em', { ascending: false });
  }

  async createBusAlert(payload: {
    origem: string; origem_slug: string;
    destino: string; destino_slug: string;
    data_ida: string; data_volta?: string | null;
    meta: number; whatsapp: string;
  }) {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: null, error: new Error('Não autenticado') };

    return this.client
      .from('bus_alerts')
      .insert({ ...payload, user_id: session.user.id });
  }

  async updateBusAlert(id: string, changes: Record<string, unknown>) {
    return this.client.from('bus_alerts').update(changes).eq('id', id);
  }

  async deleteBusAlert(id: string) {
    return this.client.from('bus_alerts').delete().eq('id', id);
  }

  async getBusCachedPrice(origemSlug: string, destinoSlug: string, dataIda: string): Promise<number | null> {
    const { data } = await this.client
      .from('bus_price_cache')
      .select('preco')
      .eq('origem_slug', origemSlug)
      .eq('destino_slug', destinoSlug)
      .eq('data_ida', dataIda)
      .not('preco', 'is', null)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.preco ?? null;
  }

  async validateBuserCity(slug: string): Promise<boolean> {
    const { data, error } = await this.client.functions.invoke('scrape-buser', {
      body: { action: 'validate_city', slug }
    });
    if (error) return false;
    return data?.valido === true;
  }

  async scrapeBuserPrice(origemSlug: string, destinoSlug: string, dataIda: string, dataVolta?: string | null): Promise<number | null> {
    const { data, error } = await this.client.functions.invoke('scrape-buser', {
      body: { origem_slug: origemSlug, destino_slug: destinoSlug, data_ida: dataIda, data_volta: dataVolta ?? null }
    });
    if (error || data?.error) return null;
    return data?.preco ?? null;
  }

  subscribeBusPriceCache(callback: () => void) {
    return this.client
      .channel('bus-price-cache-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_price_cache' }, callback)
      .subscribe();
  }
}
