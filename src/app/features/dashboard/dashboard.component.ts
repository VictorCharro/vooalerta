import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { Alert, AlertCreate } from '@core/models/alert.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./dashboard.component.css'],
  template: `
    <div class="layout">

      <!-- ── Sidebar ── -->
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="brand">
            <div class="brand-icon">✈</div>
            <span class="brand-name">VooAlerta</span>
          </div>
          <nav class="sidebar-nav">
            <button class="nav-item active">
              <span class="nav-icon">◫</span> Dashboard
            </button>
            <button class="nav-item" (click)="openProfileModal()">
              <span class="nav-icon">◯</span> Perfil
            </button>
          </nav>
        </div>
        <div class="sidebar-bottom">
          <button class="theme-btn" (click)="toggleTheme()" [title]="isDark ? 'Modo claro' : 'Modo escuro'">
            {{ isDark ? '☀' : '☾' }} {{ isDark ? 'Modo claro' : 'Modo escuro' }}
          </button>
          <div class="sidebar-user">
            <span class="user-email">{{ userEmail }}</span>
            <button class="btn-ghost sidebar-logout" (click)="logout()">Sair</button>
          </div>
        </div>
      </aside>

      <!-- ── Main ── -->
      <main class="main">

        <div class="page-header fade-up">
          <div>
            <h1>Meus alertas</h1>
            <p class="page-sub" *ngIf="!loading">
              {{ alerts.length }} rota{{ alerts.length !== 1 ? 's' : '' }} monitorada{{ alerts.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <button class="btn-primary" (click)="openModal()">+ Novo alerta</button>
        </div>

        <!-- Aviso callmebot_key ausente -->
        <div class="warn-banner fade-up" *ngIf="missingCallmebotKey">
          ⚠️ Você ainda não cadastrou sua <strong>CallMeBot API Key</strong>. As notificações não serão enviadas.
          <button class="btn-ghost warn-action" (click)="openProfileModal()">Configurar agora</button>
        </div>

        <!-- Stats -->
        <div class="stats-grid fade-up" *ngIf="alerts.length > 0">
          <div class="stat-card">
            <span class="stat-label">Total</span>
            <span class="stat-value">{{ alerts.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Ativos</span>
            <span class="stat-value green">{{ activeCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pausados</span>
            <span class="stat-value muted">{{ alerts.length - activeCount }}</span>
          </div>
        </div>

        <!-- Loading -->
        <div class="center-state" *ngIf="loading">
          <div class="spinner spinner-dark" style="width:28px;height:28px;border-width:3px"></div>
        </div>

        <!-- Empty state -->
        <div class="empty-state fade-up" *ngIf="!loading && alerts.length === 0">
          <div class="empty-icon">✈</div>
          <h3>Nenhum alerta ainda</h3>
          <p>Crie seu primeiro alerta e receba no WhatsApp quando o preço cair.</p>
          <button class="btn-primary" (click)="openModal()" style="margin-top:20px">Criar primeiro alerta</button>
        </div>

        <!-- Alert cards -->
        <div class="alerts-list" *ngIf="!loading && alerts.length > 0">
          <div
            class="alert-card fade-up"
            *ngFor="let alert of alerts; let i = index"
            [style.animation-delay]="(i * 0.04) + 's'"
            [class.card-inactive]="!alert.ativo"
          >
            <!-- Card header -->
            <div class="card-header">
              <div class="card-route">
                <span class="iata">{{ alert.origem }}</span>
                <span class="route-arrow">→</span>
                <span class="iata">{{ alert.destino }}</span>
              </div>
              <div class="card-status">
                <span class="badge" [class.badge-green]="alert.ativo" [class.badge-dim]="!alert.ativo">
                  <span class="dot"></span>{{ alert.ativo ? 'Ativo' : 'Pausado' }}
                </span>
                <label class="toggle" [title]="alert.ativo ? 'Pausar' : 'Ativar'">
                  <input type="checkbox" [checked]="alert.ativo" (change)="toggleAlert(alert)" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
              </div>
            </div>

            <!-- Prices -->
            <div class="card-prices">
              <div class="price-block">
                <span class="price-label">Sua meta</span>
                <span class="price-value">R$&nbsp;{{ alert.meta | number:'1.0-0' }}</span>
              </div>
              <div class="price-divider"></div>
              <div class="price-block" *ngIf="getMinPrice(alert) !== null">
                <span class="price-label">Menor preço</span>
                <span class="price-value" [class.price-below]="getMinPrice(alert)! <= alert.meta" [class.price-above]="getMinPrice(alert)! > alert.meta">
                  R$&nbsp;{{ getMinPrice(alert) | number:'1.0-0' }}
                </span>
                <span class="price-diff" [class.diff-green]="getMinPrice(alert)! <= alert.meta" [class.diff-red]="getMinPrice(alert)! > alert.meta">
                  {{ getMinPrice(alert)! <= alert.meta ? '↓' : '↑' }}
                  R$&nbsp;{{ (alert.meta - getMinPrice(alert)!) | number:'1.0-0' }}
                </span>
              </div>
              <div class="price-block" *ngIf="getMinPrice(alert) === null && !minPricesLoading">
                <span class="price-label">Menor preço</span>
                <span class="price-value muted">—</span>
              </div>
              <div class="price-block" *ngIf="minPricesLoading && getMinPrice(alert) === null">
                <span class="price-label">Menor preço</span>
                <span class="price-skeleton"></span>
              </div>
            </div>

            <!-- Details -->
            <div class="card-details">
              <span class="detail-tag">📅 {{ alert.data_ida | date:'dd/MM/yyyy' }}</span>
              <span class="detail-tag" *ngIf="alert.data_volta">↩ {{ alert.data_volta | date:'dd/MM/yyyy' }}</span>
              <span class="detail-tag" *ngIf="alert.horario_minimo">🕐 A partir das {{ alert.horario_minimo }}</span>
              <span class="badge badge-amber" *ngIf="alert.so_direto">Só direto</span>
            </div>

            <!-- Footer -->
            <div class="card-footer">
              <span class="card-phone">📱 {{ alert.whatsapp }}</span>
              <div class="card-actions">
                <button class="btn-icon" (click)="openEditModal(alert)" title="Editar" aria-label="Editar">✏️</button>
                <button class="btn-danger" (click)="confirmDelete(alert)">Excluir</button>
              </div>
            </div>
          </div>
        </div>

      </main>

      <!-- ── Modal perfil ── -->
      <div class="modal-overlay" *ngIf="showProfileModal" (click)="onProfileOverlayClick($event)">
        <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
          <div class="modal-head">
            <h2 id="profile-modal-title">Meu perfil</h2>
            <button class="btn-icon" (click)="closeProfileModal()" aria-label="Fechar">✕</button>
          </div>
          <div *ngIf="profileLoading" class="center-state" style="padding:32px">
            <div class="spinner spinner-dark" style="width:24px;height:24px;border-width:3px"></div>
          </div>
          <form *ngIf="!profileLoading" (ngSubmit)="saveProfile()">
            <div class="form-group">
              <label>E-mail</label>
              <input [value]="userEmail" disabled style="opacity:.45;cursor:not-allowed" />
            </div>
            <div class="form-group" style="margin-top:14px">
              <label for="p-whatsapp">WhatsApp</label>
              <div class="phone-input">
                <span class="phone-prefix">55</span>
                <input id="p-whatsapp" type="tel" [(ngModel)]="profileForm.whatsapp" name="whatsapp"
                  placeholder="11999999999" maxlength="11" />
              </div>
              <span class="form-hint">DDD + número (ex: 11999999999)</span>
            </div>
            <div class="form-group" style="margin-top:14px">
              <label for="p-key">CallMeBot API Key</label>
              <input id="p-key" type="text" [(ngModel)]="profileForm.callmebot_key" name="callmebot_key"
                placeholder="Ex: 123456" />
              <span class="form-hint">
                Não tem? Envie <strong>I allow callmebot to send me messages</strong> para
                <strong>+34 644 60 49 16</strong> no WhatsApp — a key chega em segundos.
              </span>
            </div>
            <div *ngIf="profileError" class="error-box" style="margin-top:14px">{{ profileError }}</div>
            <div *ngIf="profileSuccess" class="success-box" style="margin-top:14px">Perfil salvo com sucesso!</div>
            <div class="modal-actions">
              <button type="button" class="btn-ghost" (click)="closeProfileModal()">Cancelar</button>
              <button type="submit" class="btn-primary modal-save" [disabled]="profileSaving">
                <span *ngIf="profileSaving" class="spinner"></span>
                <span *ngIf="!profileSaving">Salvar</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ── Modal novo/editar alerta ── -->
      <div class="modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head">
            <h2 id="modal-title">{{ editingId ? 'Editar alerta' : 'Novo alerta' }}</h2>
            <button class="btn-icon" (click)="closeModal()" aria-label="Fechar">✕</button>
          </div>
          <form (ngSubmit)="saveAlert()">
            <div class="form-row">
              <div class="form-group">
                <label for="m-origem">Origem</label>
                <input id="m-origem" [(ngModel)]="form.origem" name="origem"
                  placeholder="GRU" maxlength="3"
                  (input)="form.origem = form.origem!.toUpperCase()" required />
              </div>
              <div class="form-group">
                <label for="m-destino">Destino</label>
                <input id="m-destino" [(ngModel)]="form.destino" name="destino"
                  placeholder="LIS" maxlength="3"
                  (input)="form.destino = form.destino!.toUpperCase()" required />
              </div>
            </div>
            <div class="form-row" style="margin-top:14px">
              <div class="form-group">
                <label for="m-ida">Data de ida</label>
                <input id="m-ida" type="date" [(ngModel)]="form.data_ida" name="data_ida" [min]="today" required />
              </div>
              <div class="form-group">
                <label for="m-volta">
                  Data de volta
                  <span class="form-optional">(opcional)</span>
                </label>
                <input id="m-volta" type="date" [(ngModel)]="form.data_volta" name="data_volta"
                  [min]="form.data_ida || today" [disabled]="!!form.so_ida" />
              </div>
            </div>
            <div class="form-group" style="margin-top:14px">
              <label class="toggle-label">
                <label class="toggle" style="width:38px;height:22px">
                  <input type="checkbox" [(ngModel)]="form.so_ida" name="so_ida" (change)="onSoIdaChange()" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
                <span style="font-size:14px;color:var(--color-text)">Só ida</span>
              </label>
            </div>
            <div class="form-row" style="margin-top:14px">
              <div class="form-group">
                <label for="m-meta">Meta de preço (R$)</label>
                <input id="m-meta" type="number" [(ngModel)]="form.meta" name="meta"
                  placeholder="3000" min="1" required />
              </div>
              <div class="form-group">
                <label for="m-horario">
                  Horário a partir de
                  <span class="form-optional">(opcional)</span>
                </label>
                <input id="m-horario" type="time" [(ngModel)]="form.horario_minimo" name="horario_minimo" />
              </div>
            </div>
            <div class="form-group" style="margin-top:14px">
              <label for="m-whatsapp">WhatsApp para notificação</label>
              <div class="phone-input">
                <span class="phone-prefix">55</span>
                <input id="m-whatsapp" type="tel" [(ngModel)]="form.whatsapp" name="whatsapp"
                  placeholder="11999999999" maxlength="11" required />
              </div>
              <span class="form-hint">DDD + número (ex: 11999999999)</span>
            </div>
            <div class="form-group" style="margin-top:14px">
              <label class="toggle-label">
                <label class="toggle" style="width:38px;height:22px">
                  <input type="checkbox" [(ngModel)]="form.so_direto" name="so_direto" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
                <span style="font-size:14px;color:var(--color-text)">Somente voos diretos</span>
              </label>
            </div>
            <div *ngIf="formError" class="error-box" style="margin-top:14px">{{ formError }}</div>
            <div class="modal-actions">
              <button type="button" class="btn-ghost" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary modal-save" [disabled]="saving">
                <span *ngIf="saving" class="spinner"></span>
                <span *ngIf="!saving">{{ editingId ? 'Salvar alterações' : 'Salvar alerta' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `
})
export class DashboardComponent implements OnInit {
  alerts:    Alert[] = [];
  loading    = true;
  showModal  = false;
  saving     = false;
  formError  = '';
  userEmail  = '';
  editingId: string | null = null;

  showProfileModal    = false;
  profileLoading      = false;
  profileSaving       = false;
  profileError        = '';
  profileSuccess      = false;
  profileForm         = { whatsapp: '', callmebot_key: '' };
  missingCallmebotKey = false;
  profileWhatsapp     = '';

  minPrices:        Record<string, number> = {};
  minPricesLoading  = false;

  isDark = true;

  form: Partial<Alert & { so_ida: boolean }> = this.emptyForm();
  readonly today = new Date().toISOString().split('T')[0];

  get activeCount() { return this.alerts.filter(a => a.ativo).length; }

  constructor(
      private supabase: SupabaseService,
      private router: Router
  ) {}

  async ngOnInit() {
    this.isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    const user = await this.supabase.getUser();
    this.userEmail = user?.email ?? '';
    await this.loadAlerts();
    const { data: profile } = await this.supabase.getProfile();
    this.missingCallmebotKey = !profile?.callmebot_key;
    this.profileWhatsapp     = this.stripPrefix(profile?.whatsapp ?? '');
  }

  async loadAlerts() {
    this.loading = true;
    const { data } = await this.supabase.getAlerts();
    this.alerts  = (data as Alert[]) ?? [];
    this.loading = false;
    this.loadMinPrices();
  }

  async loadMinPrices() {
    if (!this.alerts.length) return;
    this.minPricesLoading = true;
    const prices: Record<string, number> = {};
    await Promise.all(
      this.alerts.map(async (alert) => {
        const key = `${alert.origem}-${alert.destino}-${alert.data_ida}`;
        if (prices[key] === undefined) {
          const price = await this.supabase.getMinPriceForRoute(alert.origem, alert.destino, alert.data_ida);
          if (price !== null) prices[key] = price;
        }
      })
    );
    this.minPrices = prices;
    this.minPricesLoading = false;
  }

  getMinPrice(alert: Alert): number | null {
    const val = this.minPrices[`${alert.origem}-${alert.destino}-${alert.data_ida}`];
    return val !== undefined ? val : null;
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  openModal() {
    this.editingId         = null;
    this.form              = this.emptyForm();
    this.form.whatsapp     = this.profileWhatsapp;
    this.formError         = '';
    this.showModal         = true;
  }

  openEditModal(alert: Alert) {
    this.editingId = alert.id!;
    this.form = {
      origem:         alert.origem,
      destino:        alert.destino,
      data_ida:       alert.data_ida,
      data_volta:     alert.data_volta ?? '',
      meta:           alert.meta,
      horario_minimo: alert.horario_minimo ?? '00:00',
      so_direto:      alert.so_direto,
      whatsapp:       this.stripPrefix(alert.whatsapp),
      ativo:          alert.ativo,
      so_ida:         !alert.data_volta
    };
    this.formError = '';
    this.showModal = true;
  }

  onSoIdaChange() {
    if (this.form.so_ida) this.form.data_volta = '';
  }

  closeModal() { this.showModal = false; this.editingId = null; }

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeModal();
  }

  async saveAlert() {
    this.saving    = true;
    this.formError = '';

    if (this.form.data_ida && this.form.data_ida < this.today) {
      this.formError = 'A data de ida não pode ser no passado.';
      this.saving = false;
      return;
    }

    if (this.form.data_volta && this.form.data_volta < this.form.data_ida!) {
      this.formError = 'A data de volta não pode ser anterior à data de ida.';
      this.saving = false;
      return;
    }

    if ((this.form.whatsapp ?? '').replace(/\D/g, '').length !== 11) {
      this.formError = 'WhatsApp inválido. Digite DDD + número (11 dígitos, ex: 11999999999).';
      this.saving = false;
      return;
    }

    const payload = {
      origem:          this.form.origem!,
      destino:         this.form.destino!,
      data_ida:        this.form.data_ida!,
      data_volta:      this.form.so_ida ? null : (this.form.data_volta || null),
      meta:            Number(this.form.meta),
      horario_minimo:  (this.form.horario_minimo && this.form.horario_minimo !== '00:00') ? this.form.horario_minimo : null,
      so_direto:       this.form.so_direto ?? false,
      whatsapp:        '55' + this.form.whatsapp!,
      ativo:           true
    };

    let error;
    if (this.editingId) {
      ({ error } = await this.supabase.updateAlert(this.editingId, payload));
    } else {
      ({ error } = await this.supabase.createAlert(payload as AlertCreate));
    }

    if (error) {
      this.formError = this.supabase.isSessionError(error)
        ? 'Sua sessão expirou. Faça login novamente.'
        : 'Erro ao salvar alerta. Tente novamente.';
    } else {
      this.closeModal();
      await this.loadAlerts();
    }
    this.saving = false;
  }

  async toggleAlert(alert: Alert) {
    await this.supabase.updateAlert(alert.id!, { ativo: !alert.ativo });
    alert.ativo = !alert.ativo;
  }

  async confirmDelete(alert: Alert) {
    if (!confirm(`Excluir alerta ${alert.origem} → ${alert.destino}?`)) return;
    await this.supabase.deleteAlert(alert.id!);
    this.alerts = this.alerts.filter(a => a.id !== alert.id);
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }

  async openProfileModal() {
    this.showProfileModal = true;
    this.profileError     = '';
    this.profileSuccess   = false;
    this.profileLoading   = true;
    const { data } = await this.supabase.getProfile();
    this.profileForm = {
      whatsapp:      this.stripPrefix(data?.whatsapp ?? ''),
      callmebot_key: data?.callmebot_key ?? ''
    };
    this.profileLoading = false;
  }

  closeProfileModal() { this.showProfileModal = false; }

  onProfileOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeProfileModal();
  }

  async saveProfile() {
    this.profileSaving  = true;
    this.profileError   = '';
    this.profileSuccess = false;

    if (this.profileForm.whatsapp && this.profileForm.whatsapp.replace(/\D/g, '').length !== 11) {
      this.profileError  = 'WhatsApp inválido. Digite DDD + número (11 dígitos, ex: 11999999999).';
      this.profileSaving = false;
      return;
    }

    const { error } = await this.supabase.updateProfile({
      whatsapp:      this.profileForm.whatsapp ? '55' + this.profileForm.whatsapp : undefined,
      callmebot_key: this.profileForm.callmebot_key || undefined
    });

    if (error) {
      this.profileError = this.supabase.isSessionError(error)
        ? 'Sua sessão expirou. Faça login novamente.'
        : 'Erro ao salvar perfil. Tente novamente.';
    } else {
      this.profileSuccess      = true;
      this.missingCallmebotKey = !this.profileForm.callmebot_key;
      if (this.profileForm.whatsapp) this.profileWhatsapp = this.profileForm.whatsapp;
    }
    this.profileSaving = false;
  }

  private stripPrefix(phone: string): string {
    return phone.startsWith('55') ? phone.slice(2) : phone;
  }

  private emptyForm(): Partial<Alert & { so_ida: boolean }> {
    return {
      origem: '', destino: '', data_ida: '', data_volta: '',
      meta: undefined, horario_minimo: '00:00',
      so_direto: false, so_ida: false, whatsapp: '', ativo: true
    };
  }
}
