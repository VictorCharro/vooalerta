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
    const {data} = await this.client.auth.getSession();
    return data.session?.user ?? null;
  }

  onAuthChange(callback: (user: User | null) => void) {
    this.client.auth.onAuthStateChange((_, session) => {
      callback(session?.user ?? null);
    });
  }

  async getAlerts() {
    const {data: {session}} = await this.client.auth.getSession();

    return this.client
        .from('alerts')
        .select('*')
        .setHeader('Authorization', `Bearer ${session!.access_token}`)
        .order('criado_em', {ascending: false});
  }

  async createAlert(payload: AlertCreate) {
    const {data: {session}} = await this.client.auth.getSession();

    return this.client
        .from('alerts')
        .insert({...payload, user_id: session!.user.id})
        .setHeader('Authorization', `Bearer ${session!.access_token}`);
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
