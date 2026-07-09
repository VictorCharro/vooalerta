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
  async signUp(email: string, password: string, whatsapp: string) {
    return this.client.auth.signUp({
      email,
      password,
      options: {data: {whatsapp}}
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

  async updateProfile(changes: { whatsapp?: string; callmebot_key?: string }) {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: null, error: new Error('Não autenticado') };

    return this.client
        .from('profiles')
        .update(changes)
        .eq('id', session.user.id);
  }

  async getMinPriceForRoute(
    origem: string,
    destino: string,
    dataIda: string,
    options: { horarioMinimo?: string | null; soDireto?: boolean } = {}
  ): Promise<number | null> {
    let query = this.client
        .from('price_cache')
        .select('preco')
        .eq('origem', origem)
        .eq('destino', destino)
        .eq('data_ida', dataIda)
        .not('preco', 'is', null);

    if (options.horarioMinimo && options.horarioMinimo !== '00:00') {
      query = query.gte('horario_partida', options.horarioMinimo);
    }
    if (options.soDireto) {
      query = query.eq('escalas', 0);
    }

    const { data } = await query
        .order('preco', { ascending: true })
        .limit(1)
        .maybeSingle();

    return data?.preco ?? null;
  }

  async scrapeFlightPrice(origem: string, destino: string, dataIda: string, dataVolta?: string | null): Promise<{ preco: number | null; error?: string; warning?: string }> {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { preco: null, error: 'Sessão expirada. Faça login novamente.' };

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

      if (!contentType.includes('application/json')) {
        return { preco: null, error: 'A API /api/scrape-flight não retornou JSON. Em desenvolvimento local, rode pela Vercel ou configure um proxy para a API.' };
      }

      if (!res.ok) {
        return { preco: null, error: data?.error ?? `Erro ${res.status} ao chamar /api/scrape-flight` };
      }

      return {
        preco: data?.preco ?? null,
        warning: data?.warning ?? undefined
      };
    } catch (err) {
      return { preco: null, error: (err as Error).message };
    }
  }

  async getAlerts() {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return { data: [], error: null };

    return this.client
        .from('alerts')
        .select('*')
        .order('criado_em', { ascending: false });
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
