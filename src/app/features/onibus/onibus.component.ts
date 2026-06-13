import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { DatePickerComponent } from '@shared/components/date-picker/date-picker.component';

interface BusAlert {
  id: string;
  user_id: string;
  origem: string;
  origem_slug: string;
  destino: string;
  destino_slug: string;
  data_ida: string;
  data_volta?: string | null;
  meta: number;
  whatsapp: string;
  ativo: boolean;
  criado_em: string;
}

@Component({
  selector: 'app-onibus',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  styleUrls: ['./onibus.component.css'],
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
            <button class="nav-item" (click)="router.navigate(['/dashboard'])">
              <span class="nav-icon">◫</span> Dashboard
            </button>
            <button class="nav-item" (click)="router.navigate(['/dashboard'])">
              <span class="nav-icon">◯</span> Perfil
            </button>
            <button class="nav-item active">
              <span class="nav-icon">⊟</span> Ônibus
            </button>
          </nav>
        </div>
        <div class="sidebar-bottom">
          <button class="theme-btn" (click)="toggleTheme()">
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

        <div class="toast-container">
          <div class="toast fade-up" *ngFor="let t of toasts">{{ t }}</div>
        </div>

        <!-- Banners abaixo da meta -->
        <div class="price-banner fade-up" *ngFor="let a of alertsBelowMeta">
          Onibus <strong>{{ a.origem }} → {{ a.destino }}</strong> abaixo da meta —
          R$&nbsp;{{ getCachedPrice(a) | number:'1.0-0' }}
          (meta: R$&nbsp;{{ a.meta | number:'1.0-0' }})
        </div>

        <div class="page-header fade-up">
          <div>
            <h1>Ônibus</h1>
            <p class="page-sub" *ngIf="!loading">
              {{ alerts.length }} rota{{ alerts.length !== 1 ? 's' : '' }} monitorada{{ alerts.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <button class="btn-primary" (click)="openModal()">+ Novo alerta</button>
        </div>

        <!-- Loading -->
        <div class="center-state" *ngIf="loading">
          <div class="spinner spinner-dark" style="width:28px;height:28px;border-width:3px"></div>
        </div>

        <!-- Empty state -->
        <div class="empty-state fade-up" *ngIf="!loading && alerts.length === 0">
          <div class="empty-icon">—</div>
          <h3>Nenhum alerta de ônibus</h3>
          <p>Crie um alerta e receba no WhatsApp quando a passagem cair.</p>
          <button class="btn-primary" (click)="openModal()" style="margin-top:20px">Criar primeiro alerta</button>
        </div>

        <!-- Cards de alertas -->
        <div class="alerts-list" *ngIf="!loading && alerts.length > 0">
          <div
            class="alert-card fade-up"
            *ngFor="let alert of alerts; let i = index"
            [style.animation-delay]="(i * 0.04) + 's'"
            [class.card-inactive]="!alert.ativo"
          >
            <div class="card-route">
              <div class="route-iata">
                <span class="city-name">{{ alert.origem }}</span>
                <span class="route-sep">→</span>
                <span class="city-name">{{ alert.destino }}</span>
              </div>
              <div class="route-date">
                {{ alert.data_ida | date:'dd/MM/yyyy' }}
                <ng-container *ngIf="alert.data_volta"> → {{ alert.data_volta | date:'dd/MM/yyyy' }}</ng-container>
                <ng-container *ngIf="!alert.data_volta"> · Só ida</ng-container>
              </div>
              <div class="route-countdown"
                [class.countdown-green]="daysUntil(alert.data_ida) > 30"
                [class.countdown-yellow]="daysUntil(alert.data_ida) >= 7 && daysUntil(alert.data_ida) <= 30"
                [class.countdown-red]="daysUntil(alert.data_ida) > 0 && daysUntil(alert.data_ida) < 7"
                [class.countdown-muted]="daysUntil(alert.data_ida) <= 0">
                <ng-container *ngIf="daysUntil(alert.data_ida) > 0">
                  Faltam {{ daysUntil(alert.data_ida) }} dia{{ daysUntil(alert.data_ida) !== 1 ? 's' : '' }}
                </ng-container>
                <ng-container *ngIf="daysUntil(alert.data_ida) <= 0">Viagem realizada</ng-container>
              </div>
            </div>

            <div class="card-price-col">
              <span class="card-meta-label">Meta: R$&nbsp;{{ alert.meta | number:'1.0-0' }}</span>
              <ng-container *ngIf="pricesLoading && getCachedPrice(alert) === null">
                <span class="price-skeleton"></span>
              </ng-container>
              <ng-container *ngIf="!pricesLoading || getCachedPrice(alert) !== null">
                <span class="card-price-value"
                  [class.price-below]="getCachedPrice(alert) !== null && getCachedPrice(alert)! <= alert.meta"
                  [class.price-above]="getCachedPrice(alert) !== null && getCachedPrice(alert)! > alert.meta"
                  [class.price-muted]="getCachedPrice(alert) === null">
                  <ng-container *ngIf="getCachedPrice(alert) !== null">
                    R$&nbsp;{{ getCachedPrice(alert) | number:'1.0-0' }}
                    {{ getCachedPrice(alert)! <= alert.meta ? '↓' : '↑' }}
                  </ng-container>
                  <ng-container *ngIf="getCachedPrice(alert) === null">—</ng-container>
                </span>
                <span class="card-price-diff"
                  *ngIf="getCachedPrice(alert) !== null"
                  [class.diff-green]="getCachedPrice(alert)! <= alert.meta"
                  [class.diff-red]="getCachedPrice(alert)! > alert.meta">
                  {{ getCachedPrice(alert)! <= alert.meta ? '-' : '+' }}
                  R$&nbsp;{{ absDiff(alert.meta, getCachedPrice(alert)!) | number:'1.0-0' }}
                </span>
              </ng-container>
            </div>

            <div class="card-controls">
              <label class="toggle" [title]="alert.ativo ? 'Pausar' : 'Ativar'">
                <input type="checkbox" [checked]="alert.ativo" (change)="toggleAlert(alert)" />
                <span class="track"></span>
                <span class="thumb"></span>
              </label>
              <a class="open-btn"
                [href]="buildBuserUrl(alert)"
                target="_blank" rel="noopener"
                title="Abrir no Buser">↗</a>
              <button class="chevron-btn" (click)="confirmDelete(alert)" title="Excluir">✕</button>
            </div>
          </div>
        </div>

      </main>

      <!-- ── Modal novo alerta ── -->
      <div class="modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="bus-modal-title">
          <div class="modal-head">
            <h2 id="bus-modal-title">Novo alerta de ônibus</h2>
            <button class="btn-icon" (click)="closeModal()" aria-label="Fechar">✕</button>
          </div>
          <form (ngSubmit)="saveAlert()">

            <div class="form-row" style="align-items:flex-start">
              <div class="form-group">
                <label>Cidade de origem</label>
                <input [(ngModel)]="form.origem" name="origem" placeholder="Ex: Franca" required />
              </div>
              <div class="form-group" style="max-width:80px">
                <label>UF</label>
                <input [(ngModel)]="form.origem_uf" name="origem_uf" placeholder="SP" maxlength="2" required />
              </div>
            </div>

            <div class="form-row" style="align-items:flex-start;margin-top:14px">
              <div class="form-group">
                <label>Cidade de destino</label>
                <input [(ngModel)]="form.destino" name="destino" placeholder="Ex: São Paulo" required />
              </div>
              <div class="form-group" style="max-width:80px">
                <label>UF</label>
                <input [(ngModel)]="form.destino_uf" name="destino_uf" placeholder="SP" maxlength="2" required />
              </div>
            </div>

            <div class="form-row" style="margin-top:14px">
              <div class="form-group">
                <label>Data de ida</label>
                <app-date-picker
                  [value]="form.data_ida"
                  [min]="today"
                  placeholder="Selecionar data"
                  (valueChange)="form.data_ida = $event">
                </app-date-picker>
              </div>
              <div class="form-group">
                <label>Data de volta <span class="form-optional">(opcional)</span></label>
                <app-date-picker
                  [value]="form.data_volta"
                  [min]="form.data_ida || today"
                  align="right"
                  placeholder="Selecionar data"
                  (valueChange)="form.data_volta = $event">
                </app-date-picker>
              </div>
            </div>

            <div class="form-row" style="margin-top:14px">
              <div class="form-group">
                <label for="bus-meta">Meta de preço (R$)</label>
                <input id="bus-meta" type="number" [(ngModel)]="form.meta" name="meta"
                  placeholder="150" min="1" required />
              </div>
              <div class="form-group">
                <label for="bus-whatsapp">WhatsApp para notificação</label>
                <div class="phone-input">
                  <span class="phone-prefix">55</span>
                  <input id="bus-whatsapp" type="tel" [(ngModel)]="form.whatsapp" name="whatsapp"
                    placeholder="11999999999" maxlength="11" required />
                </div>
                <span class="form-hint">DDD + número (ex: 11999999999)</span>
              </div>
            </div>

            <div *ngIf="formError" class="error-box" style="margin-top:14px">{{ formError }}</div>
            <div class="modal-actions">
              <button type="button" class="btn-ghost" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary modal-save" [disabled]="saving">
                <span *ngIf="saving" class="spinner"></span>
                <span *ngIf="!saving">Salvar alerta</span>
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `
})
export class OnibusComponent implements OnInit, OnDestroy {
  alerts: BusAlert[] = [];
  loading    = true;
  showModal  = false;
  saving     = false;
  formError  = '';
  userEmail  = '';
  isDark     = true;
  toasts:    string[] = [];
  cachedPrices: Record<string, number> = {};
  pricesLoading = false;
  private profileWhatsapp = '';
  private realtimeChannel: any;

  form = this.emptyForm();
  readonly today = new Date().toISOString().split('T')[0];

  get alertsBelowMeta(): BusAlert[] {
    return this.alerts.filter(a => {
      const p = this.getCachedPrice(a);
      return p !== null && p <= a.meta;
    });
  }

  constructor(public router: Router, private supabase: SupabaseService) {}

  async ngOnInit() {
    this.isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    const user = await this.supabase.getUser();
    this.userEmail = user?.email ?? '';

    const { data: profile } = await this.supabase.getProfile();
    this.profileWhatsapp = this.stripPrefix(profile?.whatsapp ?? '');

    await this.loadAlerts();

    this.realtimeChannel = this.supabase.subscribeBusPriceCache(async () => {
      await this.loadCachedPrices();
    });
  }

  ngOnDestroy() {
    this.realtimeChannel?.unsubscribe();
  }

  async loadAlerts() {
    this.loading = true;
    const { data } = await this.supabase.getBusAlerts();
    this.alerts  = (data as BusAlert[]) ?? [];
    this.loading = false;
    this.loadCachedPrices();
  }

  async loadCachedPrices() {
    if (!this.alerts.length) return;
    this.pricesLoading = true;
    const prices: Record<string, number> = {};
    await Promise.all(
      this.alerts.map(async (a) => {
        const key = `${a.origem_slug}-${a.destino_slug}-${a.data_ida}`;
        if (prices[key] === undefined) {
          const p = await this.supabase.getBusCachedPrice(a.origem_slug, a.destino_slug, a.data_ida);
          if (p !== null) prices[key] = p;
        }
      })
    );
    this.cachedPrices = prices;
    this.pricesLoading = false;
  }

  getCachedPrice(alert: BusAlert): number | null {
    const val = this.cachedPrices[`${alert.origem_slug}-${alert.destino_slug}-${alert.data_ida}`];
    return val !== undefined ? val : null;
  }

  absDiff(a: number, b: number): number { return Math.abs(a - b); }

  daysUntil(date: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(date + 'T00:00:00');
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  buildBuserUrl(a: BusAlert): string {
    let url = `https://www.buser.com.br/onibus/${a.origem_slug}/${a.destino_slug}?ida=${a.data_ida}`;
    if (a.data_volta) url += `&volta=${a.data_volta}`;
    return url;
  }

  toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  openModal() {
    this.form          = this.emptyForm();
    this.form.whatsapp = this.profileWhatsapp;
    this.formError     = '';
    this.showModal     = true;
  }

  closeModal() { this.showModal = false; }

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeModal();
  }

  async saveAlert() {
    this.saving    = true;
    this.formError = '';

    if (!this.form.origem || !this.form.origem_uf || !this.form.destino || !this.form.destino_uf) {
      this.formError = 'Preencha cidade e UF de origem e destino.';
      this.saving = false;
      return;
    }

    if (!this.form.data_ida || this.form.data_ida < this.today) {
      this.formError = 'Data de ida inválida.';
      this.saving = false;
      return;
    }

    if ((this.form.whatsapp ?? '').replace(/\D/g, '').length !== 11) {
      this.formError = 'WhatsApp inválido. Digite DDD + número (11 dígitos).';
      this.saving = false;
      return;
    }

    const origemSlug  = this.toSlug(this.form.origem) + '-' + this.form.origem_uf.toLowerCase();
    const destinoSlug = this.toSlug(this.form.destino) + '-' + this.form.destino_uf.toLowerCase();

    const { error } = await this.supabase.createBusAlert({
      origem:       this.form.origem,
      origem_slug:  origemSlug,
      destino:      this.form.destino,
      destino_slug: destinoSlug,
      data_ida:     this.form.data_ida,
      data_volta:   this.form.data_volta || null,
      meta:         Number(this.form.meta),
      whatsapp:     '55' + this.form.whatsapp
    });

    if (error) {
      this.formError = this.supabase.isSessionError(error)
        ? 'Sua sessão expirou. Faça login novamente.'
        : 'Erro ao salvar alerta. Tente novamente.';
    } else {
      this.closeModal();
      await this.loadAlerts();
      this.showToast(`Alerta ${this.form.origem} → ${this.form.destino} criado!`);
    }
    this.saving = false;
  }

  async toggleAlert(alert: BusAlert) {
    await this.supabase.updateBusAlert(alert.id, { ativo: !alert.ativo });
    alert.ativo = !alert.ativo;
  }

  async confirmDelete(alert: BusAlert) {
    if (!confirm(`Excluir alerta ${alert.origem} → ${alert.destino}?`)) return;
    await this.supabase.deleteBusAlert(alert.id);
    this.alerts = this.alerts.filter(a => a.id !== alert.id);
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }

  showToast(msg: string) {
    this.toasts.push(msg);
    setTimeout(() => this.toasts.shift(), 4000);
  }

  private stripPrefix(phone: string): string {
    return phone.startsWith('55') ? phone.slice(2) : phone;
  }

  private emptyForm() {
    return {
      origem: '', origem_uf: '',
      destino: '', destino_uf: '',
      data_ida: '', data_volta: '',
      meta: undefined as number | undefined,
      whatsapp: ''
    };
  }
}
