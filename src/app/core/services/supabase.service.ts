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
}
