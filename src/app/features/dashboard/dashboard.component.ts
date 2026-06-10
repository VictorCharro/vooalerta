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
  template: `
    <div class="layout">

      <!-- ── Navbar ── -->
      <nav class="navbar">
        <div class="nav-brand">
          <div class="nav-brand-icon">✈</div>
          <span class="nav-brand-name">VooAlerta</span>
        </div>
        <div class="nav-right">
          <button class="btn-ghost nav-email" (click)="openProfileModal()">{{ userEmail }}</button>
          <button class="btn-ghost nav-logout" (click)="logout()">Sair</button>
        </div>
      </nav>

      <!-- ── Main ── -->
      <main class="main">

        <!-- Header -->
        <div class="page-header fade-up">
          <div>
            <h1>Meus alertas</h1>
            <p class="page-sub" *ngIf="!loading">
              {{ alerts.length }} rota{{ alerts.length !== 1 ? 's' : '' }} monitorada{{ alerts.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <button class="btn-primary" (click)="openModal()">+ Novo alerta</button>
        </div>

        <!-- Stats -->
        <div class="stats-grid fade-up" style="animation-delay:.04s" *ngIf="alerts.length > 0">
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
          <button class="btn-primary" (click)="openModal()" style="margin-top: 20px">
            Criar primeiro alerta
          </button>
        </div>

        <!-- Alert cards -->
        <div class="alerts-list" *ngIf="!loading && alerts.length > 0">
          <div
            class="alert-card fade-up"
            *ngFor="let alert of alerts; let i = index"
            [style.animation-delay]="(i * 0.04) + 's'"
            [class.card-inactive]="!alert.ativo"
          >
            <div class="ac-top">
              <div class="ac-route">
                <span class="ac-iata">{{ alert.origem }}</span>
                <span class="ac-arrow">→</span>
                <span class="ac-iata">{{ alert.destino }}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="badge" [class.badge-green]="alert.ativo" [class.badge-dim]="!alert.ativo">
                  <span class="dot"></span>
                  {{ alert.ativo ? 'Ativo' : 'Pausado' }}
                </span>
                <button class="btn-icon" (click)="openEditModal(alert)" title="Editar alerta" aria-label="Editar alerta">✏️</button>
              </div>
            </div>

            <div class="ac-meta">
              <div class="ac-meta-item">
                <span class="ac-meta-label">Meta</span>
                <span class="ac-meta-value accent">R$&nbsp;{{ alert.meta | number:'1.0-0' }}</span>
              </div>
              <div class="ac-meta-item">
                <span class="ac-meta-label">Ida</span>
                <span class="ac-meta-value">{{ alert.data_ida | date:'dd/MM/yy' }}</span>
              </div>
              <div class="ac-meta-item" *ngIf="alert.data_volta">
                <span class="ac-meta-label">Volta</span>
                <span class="ac-meta-value">{{ alert.data_volta | date:'dd/MM/yy' }}</span>
              </div>
              <div class="ac-meta-item" *ngIf="alert.horario_minimo">
                <span class="ac-meta-label">A partir de</span>
                <span class="ac-meta-value">{{ alert.horario_minimo }}</span>
              </div>
              <div class="ac-meta-item" *ngIf="alert.so_direto">
                <span class="ac-meta-label">Tipo</span>
                <span class="ac-meta-value">Só direto</span>
              </div>
            </div>

            <div class="ac-footer">
              <span class="ac-phone">📱 {{ alert.whatsapp }}</span>
              <div class="ac-actions">
                <label class="toggle" [title]="alert.ativo ? 'Pausar alerta' : 'Ativar alerta'">
                  <input type="checkbox" [checked]="alert.ativo" (change)="toggleAlert(alert)" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
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

      <!-- ── Modal novo alerta ── -->
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

            <div class="form-row" style="margin-top: 14px">
              <div class="form-group">
                <label for="m-ida">Data de ida</label>
                <input id="m-ida" type="date" [(ngModel)]="form.data_ida" name="data_ida" required />
              </div>
              <div class="form-group">
                <label for="m-volta">
                  Data de volta
                  <span class="form-optional">(opcional)</span>
                </label>
                <input id="m-volta" type="date" [(ngModel)]="form.data_volta" name="data_volta" />
              </div>
            </div>

            <div class="form-row" style="margin-top: 14px">
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

            <div class="form-group" style="margin-top: 14px">
              <label for="m-whatsapp">WhatsApp para notificação</label>
              <div class="phone-input">
                <span class="phone-prefix">55</span>
                <input id="m-whatsapp" type="tel" [(ngModel)]="form.whatsapp" name="whatsapp"
                  placeholder="11999999999" maxlength="11" required />
              </div>
              <span class="form-hint">DDD + número (ex: 11999999999)</span>
            </div>

            <div class="form-group" style="margin-top: 14px">
              <label class="toggle-label">
                <label class="toggle" style="width:38px;height:22px">
                  <input type="checkbox" [(ngModel)]="form.so_direto" name="so_direto" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
                <span style="font-size:14px;color:var(--color-text)">Somente voos diretos</span>
              </label>
            </div>

            <div *ngIf="formError" class="error-box" style="margin-top: 14px">{{ formError }}</div>

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
  `,
  styles: [`
    .layout { min-height: 100vh; display: flex; flex-direction: column; }
    .navbar { height: var(--navbar-h); display: flex; align-items: center; justify-content: space-between; padding: 0 var(--space-lg); border-bottom: 1px solid var(--color-border); background: var(--color-bg); position: sticky; top: 0; z-index: 20; }
    .nav-brand { display: flex; align-items: center; gap: 10px; }
    .nav-brand-icon { width: 32px; height: 32px; background: var(--color-accent-dim); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .nav-brand-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-email { font-size: 12px; color: var(--color-text-muted); padding: 4px 8px; border-radius: var(--radius-sm); transition: background var(--transition), color var(--transition); }
    .nav-email:hover { background: var(--color-bg-3); color: var(--color-text); }
    .nav-logout { padding: 6px 14px; font-size: 13px; }
    .main { flex: 1; max-width: var(--content-w); margin: 0 auto; width: 100%; padding: 32px var(--space-lg); }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-lg); gap: 16px; }
    h1 { font-size: 26px; margin-bottom: 4px; }
    .page-sub { color: var(--color-text-muted); font-size: 13px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
    .center-state { display: flex; justify-content: center; padding: 60px; }
    .empty-state { text-align: center; padding: 60px var(--space-lg); }
    .empty-icon { font-size: 42px; opacity: 0.15; margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; margin-bottom: 8px; }
    .empty-state p { color: var(--color-text-muted); font-size: 14px; }
    .alerts-list { display: grid; gap: 12px; }
    .alert-card { background: var(--color-bg-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 22px; transition: border-color var(--transition), opacity var(--transition); }
    .alert-card:hover { border-color: var(--color-border-hover); }
    .alert-card.card-inactive { opacity: 0.45; }
    .ac-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .ac-route { display: flex; align-items: center; gap: 10px; }
    .ac-iata { font-family: var(--font-display); font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
    .ac-arrow { color: var(--color-text-dim); font-size: 14px; }
    .ac-meta { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 16px; }
    .ac-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .ac-meta-label { font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .ac-meta-value { font-size: 14px; font-weight: 500; }
    .ac-meta-value.accent { color: var(--color-accent); font-family: var(--font-display); font-size: 17px; }
    .ac-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--color-border); padding-top: 14px; gap: 12px; }
    .ac-phone { font-size: 12px; color: var(--color-text-muted); }
    .ac-actions { display: flex; align-items: center; gap: 12px; }
    .modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.72); display: flex; align-items: center; justify-content: center; padding: var(--space-lg); }
    .modal { width: 100%; max-width: 500px; background: var(--color-bg-2); border: 1px solid var(--color-border-hover); border-radius: var(--radius-lg); padding: 28px 32px; max-height: 90vh; overflow-y: auto; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .modal-head h2 { font-size: 18px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }
    .modal-save { min-width: 140px; padding: 10px 20px; }
    .toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .success-box { background: var(--color-green-dim); color: var(--color-green); border: 1px solid rgba(45,212,160,0.2); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; }
    .phone-input { display: flex; align-items: stretch; }
    .phone-prefix { display: flex; align-items: center; padding: 0 12px; background: var(--color-bg-3); border: 1px solid var(--color-border); border-right: none; border-radius: var(--radius-sm) 0 0 var(--radius-sm); font-size: 14px; color: var(--color-text-muted); white-space: nowrap; }
    .phone-input input { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; flex: 1; min-width: 0; }
  `]
})
export class DashboardComponent implements OnInit {
  alerts:    Alert[] = [];
  loading    = true;
  showModal  = false;
  saving     = false;
  formError  = '';
  userEmail  = '';
  editingId: string | null = null;

  showProfileModal = false;
  profileLoading   = false;
  profileSaving    = false;
  profileError     = '';
  profileSuccess   = false;
  profileForm      = { whatsapp: '', callmebot_key: '' };

  form: Partial<Alert> = this.emptyForm();

  get activeCount() { return this.alerts.filter(a => a.ativo).length; }

  constructor(
      private supabase: SupabaseService,
      private router: Router
  ) {}

  async ngOnInit() {
    const user = await this.supabase.getUser();
    this.userEmail = user?.email ?? '';
    await this.loadAlerts();
  }

  async loadAlerts() {
    this.loading = true;
    const { data } = await this.supabase.getAlerts();
    this.alerts  = (data as Alert[]) ?? [];
    this.loading = false;
  }

  openModal() {
    this.editingId = null;
    this.form      = this.emptyForm();
    this.formError = '';
    this.showModal = true;
  }

  openEditModal(alert: Alert) {
    this.editingId = alert.id!;
    this.form = {
      origem:         alert.origem,
      destino:        alert.destino,
      data_ida:       alert.data_ida,
      data_volta:     alert.data_volta ?? '',
      meta:           alert.meta,
      horario_minimo: alert.horario_minimo ?? '',
      so_direto:      alert.so_direto,
      whatsapp:       this.stripPrefix(alert.whatsapp),
      ativo:          alert.ativo
    };
    this.formError = '';
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.editingId = null; }

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  async saveAlert() {
    this.saving    = true;
    this.formError = '';

    if ((this.form.whatsapp ?? '').replace(/\D/g, '').length !== 11) {
      this.formError = 'WhatsApp inválido. Digite DDD + número (11 dígitos, ex: 11999999999).';
      this.saving = false;
      return;
    }

    const payload = {
      origem:          this.form.origem!,
      destino:         this.form.destino!,
      data_ida:        this.form.data_ida!,
      data_volta:      this.form.data_volta || null,
      meta:            Number(this.form.meta),
      horario_minimo:  this.form.horario_minimo || null,
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
      this.formError = 'Erro ao salvar alerta. Tente novamente.';
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

  closeProfileModal() {
    this.showProfileModal = false;
  }

  onProfileOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeProfileModal();
    }
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
      whatsapp:      '55' + this.profileForm.whatsapp,
      callmebot_key: this.profileForm.callmebot_key
    });

    if (error) {
      this.profileError = 'Erro ao salvar perfil. Tente novamente.';
    } else {
      this.profileSuccess = true;
    }
    this.profileSaving = false;
  }

  private stripPrefix(phone: string): string {
    return phone.startsWith('55') ? phone.slice(2) : phone;
  }

  private emptyForm(): Partial<Alert> {
    return {
      origem:         '',
      destino:        '',
      data_ida:       '',
      data_volta:     '',
      meta:           undefined,
      horario_minimo: '',
      so_direto:      false,
      whatsapp:       '',
      ativo:          true
    };
  }
}