import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { Alert, AlertCreate } from '@core/models/alert.model';
import { AirportSearchComponent } from '@shared/components/airport-search/airport-search.component';
import { DatePickerComponent } from '@shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { SidebarComponent } from '@shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-voos',
  standalone: true,
  imports: [CommonModule, FormsModule, AirportSearchComponent, DatePickerComponent, TimePickerComponent, SidebarComponent],
  styleUrls: ['./voos.component.css'],
  template: `
    <div class="layout">

      <app-sidebar active="voos" [userEmail]="userEmail" [isDark]="isDark"
        (themeChange)="isDark = $event"
        (profileSaved)="onProfileSaved($event)">
      </app-sidebar>

      <!-- ── Main ── -->
      <main class="main">

        <!-- ── Toasts ── -->
        <div class="toast-container">
          <div class="toast fade-up" *ngFor="let t of toasts">{{ t }}</div>
        </div>

        <!-- ══ LISTA ══ -->
        <ng-container *ngIf="!selectedAlert">

          <div class="page-header fade-up">
            <div>
              <h1>Voos</h1>
              <p class="page-sub" *ngIf="!loading">
                {{ alerts.length }} rota{{ alerts.length !== 1 ? 's' : '' }} monitorada{{ alerts.length !== 1 ? 's' : '' }}
              </p>
            </div>
            <button class="btn-primary" (click)="openModal()">+ Novo alerta</button>
          </div>

          <!-- Aviso callmebot_key ausente -->
          <div class="warn-banner fade-up" *ngIf="missingCallmebotKey">
            ⚠️ Você ainda não cadastrou sua <strong>CallMeBot API Key</strong>. As notificações não serão enviadas. Acesse <strong>Perfil</strong> na sidebar para configurar.
          </div>

          <!-- Banners de alerta de preço -->
          <div class="price-banner fade-up" *ngFor="let a of alertsBelowMeta">
            🔔 Alerta! O voo <strong>{{ a.origem }} → {{ a.destino }}</strong> está abaixo da sua meta —
            R$&nbsp;{{ getMinPrice(a) | number:'1.0-0' }}
            (meta: R$&nbsp;{{ a.meta | number:'1.0-0' }})
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
              <div class="card-route">
                <div class="route-iata">
                  <span class="iata">{{ alert.origem }}</span>
                  <span class="route-sep">→</span>
                  <span class="iata">{{ alert.destino }}</span>
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
                <ng-container *ngIf="minPricesLoading && getMinPrice(alert) === null">
                  <span class="price-skeleton"></span>
                </ng-container>
                <ng-container *ngIf="!minPricesLoading || getMinPrice(alert) !== null">
                  <span class="card-price-value"
                    [class.price-below]="getMinPrice(alert) !== null && getMinPrice(alert)! <= alert.meta"
                    [class.price-above]="getMinPrice(alert) !== null && getMinPrice(alert)! > alert.meta"
                    [class.price-muted]="getMinPrice(alert) === null">
                    <ng-container *ngIf="getMinPrice(alert) !== null">
                      R$&nbsp;{{ getMinPrice(alert) | number:'1.0-0' }}
                      {{ getMinPrice(alert)! <= alert.meta ? '↓' : '↑' }}
                    </ng-container>
                    <ng-container *ngIf="getMinPrice(alert) === null">—</ng-container>
                  </span>
                  <span class="card-price-diff"
                    *ngIf="getMinPrice(alert) !== null"
                    [class.diff-green]="getMinPrice(alert)! <= alert.meta"
                    [class.diff-red]="getMinPrice(alert)! > alert.meta">
                    {{ getMinPrice(alert)! <= alert.meta ? '-' : '+' }}
                    R$&nbsp;{{ absDiff(alert.meta, getMinPrice(alert)!) | number:'1.0-0' }}
                  </span>
                </ng-container>
              </div>

              <div class="card-controls">
                <label class="toggle" [title]="alert.ativo ? 'Pausar' : 'Ativar'">
                  <input type="checkbox" [checked]="alert.ativo" (change)="toggleAlert(alert)" />
                  <span class="track"></span>
                  <span class="thumb"></span>
                </label>
                <button class="share-btn" (click)="shareAlert(alert)" title="Compartilhar">⤴</button>
                <button class="chevron-btn" (click)="openDetail(alert)" title="Ver detalhes">›</button>
              </div>
            </div>
          </div>

        </ng-container>

        <!-- ══ DETALHE ══ -->
        <div class="detail-view fade-up" *ngIf="selectedAlert">

          <div class="detail-header">
            <button class="back-btn" (click)="closeDetail()">← Voltar</button>
            <h1 class="detail-title">
              {{ selectedAlert.origem }}
              <span class="detail-arrow">→</span>
              {{ selectedAlert.destino }}
            </h1>
          </div>

          <!-- Cards de estatística -->
          <div class="stat-grid">
            <div class="stat-card">
              <span class="stat-label">Menor preço</span>
              <span class="stat-value"
                [class.stat-green]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! <= selectedAlert.meta"
                [class.stat-red]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! > selectedAlert.meta">
                <ng-container *ngIf="getMinPrice(selectedAlert) !== null">
                  R$&nbsp;{{ getMinPrice(selectedAlert) | number:'1.0-0' }}
                </ng-container>
                <ng-container *ngIf="getMinPrice(selectedAlert) === null && minPricesLoading">
                  <span class="price-skeleton" style="width:80px;height:28px;display:inline-block"></span>
                </ng-container>
                <ng-container *ngIf="getMinPrice(selectedAlert) === null && !minPricesLoading">—</ng-container>
              </span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Preço atual</span>
              <span class="stat-value"
                [class.stat-green]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! <= selectedAlert.meta"
                [class.stat-red]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! > selectedAlert.meta">
                <ng-container *ngIf="getMinPrice(selectedAlert) !== null">
                  R$&nbsp;{{ getMinPrice(selectedAlert) | number:'1.0-0' }}
                </ng-container>
                <ng-container *ngIf="getMinPrice(selectedAlert) === null">—</ng-container>
              </span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Sua meta</span>
              <span class="stat-value">R$&nbsp;{{ selectedAlert.meta | number:'1.0-0' }}</span>
            </div>
          </div>

          <!-- Formulário de edição (grid 2 colunas) -->
          <form (ngSubmit)="saveAlert()">

            <div class="detail-grid">

              <!-- Coluna esquerda: campos da rota -->
              <div class="info-section">
                <h3 class="section-title">Detalhes da rota</h3>
                <div class="form-row">
                  <div class="form-group">
                    <label>Origem</label>
                    <app-airport-search
                      inputId="d-origem"
                      placeholder="GRU — São Paulo"
                      [value]="form.origem || ''"
                      (selected)="form.origem = $event">
                    </app-airport-search>
                  </div>
                  <div class="form-group">
                    <label>Destino</label>
                    <app-airport-search
                      inputId="d-destino"
                      placeholder="LIS — Lisboa"
                      [value]="form.destino || ''"
                      (selected)="form.destino = $event">
                    </app-airport-search>
                  </div>
                </div>
                <div class="form-row" style="margin-top:14px">
                  <div class="form-group">
                    <label>Data de ida</label>
                    <app-date-picker
                      [value]="form.data_ida || ''"
                      [min]="today"
                      placeholder="Selecionar data"
                      (valueChange)="form.data_ida = $event">
                    </app-date-picker>
                  </div>
                  <div class="form-group">
                    <label>Data de volta <span class="form-optional">(opcional)</span></label>
                    <app-date-picker
                      [value]="form.data_volta || ''"
                      [min]="form.data_ida || today"
                      [disabled]="!!form.so_ida"
                      placeholder="Selecionar data"
                      (valueChange)="form.data_volta = $event">
                    </app-date-picker>
                  </div>
                </div>
                <div class="form-group" style="margin-top:14px">
                  <label class="toggle-label">
                    <label class="toggle" style="width:38px;height:22px">
                      <input type="checkbox" [(ngModel)]="form.so_ida" name="d_so_ida" (change)="onSoIdaChange()" />
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </label>
                    <span style="font-size:14px;color:var(--color-text)">Só ida</span>
                  </label>
                </div>
                <div class="form-row" style="margin-top:14px">
                  <div class="form-group">
                    <label for="d-meta">Meta de preço (R$)</label>
                    <input id="d-meta" type="number" [(ngModel)]="form.meta" name="d_meta"
                      placeholder="3000" min="1" required />
                  </div>
                  <div class="form-group">
                    <label for="d-horario">Horário a partir de <span class="form-optional">(opcional)</span></label>
                    <app-time-picker name="d_horario"
                      [value]="form.horario_minimo || '00:00'"
                      (valueChange)="form.horario_minimo = $event">
                    </app-time-picker>
                  </div>
                </div>
                <div class="form-group" style="margin-top:14px">
                  <label for="d-whatsapp">WhatsApp para notificação</label>
                  <div class="phone-input">
                    <span class="phone-prefix">55</span>
                    <input id="d-whatsapp" type="tel" [(ngModel)]="form.whatsapp" name="d_whatsapp"
                      placeholder="11999999999" maxlength="11" required />
                  </div>
                  <span class="form-hint">DDD + número (ex: 11999999999)</span>
                </div>
              </div>

              <!-- Coluna direita: info do voo + configurações -->
              <div class="detail-right">

                <div class="info-section">
                  <h3 class="section-title">Informações do voo</h3>
                  <div class="info-row">
                    <span class="info-label">Companhia</span>
                    <span class="info-value">Qualquer</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Classe</span>
                    <span class="info-value">Econômica</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Escalas</span>
                    <span class="info-value">{{ form.so_direto ? 'Só direto' : 'Qualquer' }}</span>
                  </div>
                  <div class="info-row">
                    <label class="toggle-label" style="width:100%">
                      <label class="toggle" style="width:38px;height:22px">
                        <input type="checkbox" [(ngModel)]="form.so_direto" name="d_so_direto" />
                        <span class="track"></span>
                        <span class="thumb"></span>
                      </label>
                      <span style="font-size:14px;color:var(--color-text)">Somente voos diretos</span>
                    </label>
                  </div>
                  <div class="info-row" style="border-bottom:none;padding-bottom:0">
                    <span class="info-label">Abrir no Google Flights</span>
                    <a class="open-btn" [href]="buildGoogleFlightsUrl(selectedAlert)" target="_blank" rel="noopener" title="Abrir no Google Flights">↗</a>
                  </div>
                </div>

                <div class="info-section">
                  <h3 class="section-title">Configurações</h3>
                  <div class="info-row" style="border-bottom:none;padding-bottom:0">
                    <div>
                      <span class="info-label" style="font-size:14px;color:var(--color-text)">Ativar notificações</span>
                      <p class="form-hint" style="margin:2px 0 0">
                        Receba uma mensagem no WhatsApp quando o preço cair abaixo da meta.
                      </p>
                    </div>
                    <label class="toggle" style="flex-shrink:0">
                      <input type="checkbox" [(ngModel)]="form.ativo" name="d_ativo" (change)="toggleDetailAlert()" />
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            <div *ngIf="formError" class="error-box" style="margin-top:4px">{{ formError }}</div>

            <div class="detail-actions">
              <button type="button" class="btn-danger" (click)="confirmDeleteDetail()">Excluir alerta</button>
              <button type="submit" class="btn-primary" [disabled]="saving">
                <span *ngIf="saving" class="spinner"></span>
                <span *ngIf="!saving">Salvar alterações</span>
              </button>
            </div>

          </form>
        </div>

      </main>

      <!-- ── Modal novo alerta ── -->
      <div class="modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head">
            <h2 id="modal-title">Novo alerta</h2>
            <button class="btn-icon" (click)="closeModal()" aria-label="Fechar">✕</button>
          </div>
          <form (ngSubmit)="saveAlert()">
            <div class="form-row" style="align-items: flex-start">
              <div class="form-group">
                <label>Origem</label>
                <div class="chips-input">
                  <span class="chip" *ngFor="let o of origens">
                    {{ o }}
                    <button type="button" class="chip-remove" (click)="removeOrigen(o)">×</button>
                  </span>
                  <app-airport-search
                    inputId="m-origem"
                    [placeholder]="origens.length === 0 ? 'GRU — São Paulo' : '+ Adicionar'"
                    value=""
                    (selected)="addOrigenFromSearch($event)"
                    style="flex:1;min-width:120px">
                  </app-airport-search>
                </div>
                <span class="form-hint">Digite e pressione Enter para adicionar mais</span>
              </div>
              <div class="form-group">
                <label>Destino</label>
                <app-airport-search
                  inputId="m-destino"
                  placeholder="LIS — Lisboa"
                  [value]="form.destino || ''"
                  (selected)="form.destino = $event">
                </app-airport-search>
              </div>
            </div>
            <div class="form-row" style="margin-top:14px">
              <div class="form-group">
                <label>Data de ida</label>
                <app-date-picker
                  [value]="form.data_ida || ''"
                  [min]="today"
                  placeholder="Selecionar data"
                  (valueChange)="form.data_ida = $event">
                </app-date-picker>
              </div>
              <div class="form-group">
                <label>Data de volta <span class="form-optional">(opcional)</span></label>
                <app-date-picker
                  [value]="form.data_volta || ''"
                  [min]="form.data_ida || today"
                  [disabled]="!!form.so_ida"
                  align="right"
                  placeholder="Selecionar data"
                  (valueChange)="form.data_volta = $event">
                </app-date-picker>
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
                  Horário a partir de <span class="form-optional">(opcional)</span>
                </label>
                <app-time-picker name="horario_minimo"
                  [value]="form.horario_minimo || '00:00'"
                  (valueChange)="form.horario_minimo = $event">
                </app-time-picker>
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
                <span *ngIf="!saving">
                  Salvar{{ origens.length > 1 ? ' ' + origens.length + ' alertas' : ' alerta' }}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `
})
export class VoosComponent implements OnInit, OnDestroy {
  alerts:    Alert[] = [];
  loading    = true;
  showModal  = false;
  saving     = false;
  formError  = '';
  userEmail  = '';
  editingId: string | null = null;

  selectedAlert: Alert | null = null;

  missingCallmebotKey = false;
  profileWhatsapp     = '';

  minPrices:        Record<string, number> = {};
  minPricesLoading  = false;
  toasts:           string[] = [];
  private realtimeChannel: any;

  isDark = true;

  origens: string[] = [];
  origenInput = '';

  form: Partial<Alert & { so_ida: boolean }> = this.emptyForm();
  readonly today = new Date().toISOString().split('T')[0];

  get activeCount() { return this.alerts.filter(a => a.ativo).length; }

  get alertsBelowMeta(): Alert[] {
    return this.alerts.filter(a => {
      const p = this.getMinPrice(a);
      return p !== null && p <= a.meta;
    });
  }

  constructor(
      private supabase: SupabaseService,
      public router: Router
  ) {}

  async ngOnInit() {
    this.isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    const user = await this.supabase.getUser();
    this.userEmail = user?.email ?? '';
    await this.loadAlerts();
    const { data: profile } = await this.supabase.getProfile();
    this.missingCallmebotKey = !profile?.callmebot_key;
    this.profileWhatsapp     = this.stripPrefix(profile?.whatsapp ?? '');

    this.realtimeChannel = this.supabase.subscribePriceCache(async () => {
      const prevPrices = { ...this.minPrices };
      await this.loadMinPrices();
      for (const alert of this.alerts) {
        const key = `${alert.origem}-${alert.destino}-${alert.data_ida}`;
        const prev = prevPrices[key];
        const curr = this.minPrices[key];
        if (curr !== undefined && curr <= alert.meta && (prev === undefined || prev > alert.meta)) {
          this.showToast(`✈ ${alert.origem} → ${alert.destino} abaixo da meta! R$ ${curr}`);
        }
      }
    });
  }

  ngOnDestroy() {
    this.realtimeChannel?.unsubscribe();
  }

  showToast(msg: string) {
    this.toasts.push(msg);
    setTimeout(() => this.toasts.shift(), 5000);
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
          const price = await this.supabase.getMinPriceForRoute(
            alert.origem, alert.destino, alert.data_ida,
            { horarioMinimo: alert.horario_minimo, soDireto: alert.so_direto }
          );
          if (price !== null) prices[key] = price;
        }
      })
    );
    this.minPrices = prices;
    this.minPricesLoading = false;
  }

  absDiff(a: number, b: number): number { return Math.abs(a - b); }

  daysUntil(date: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(date + 'T00:00:00');
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  getMinPrice(alert: Alert): number | null {
    const val = this.minPrices[`${alert.origem}-${alert.destino}-${alert.data_ida}`];
    return val !== undefined ? val : null;
  }

  onProfileSaved(event: { whatsapp: string }) {
    if (event.whatsapp) this.profileWhatsapp = event.whatsapp;
  }

  openModal() {
    this.editingId     = null;
    this.form          = this.emptyForm();
    this.form.whatsapp = this.profileWhatsapp;
    this.formError     = '';
    this.origens       = [];
    this.origenInput   = '';
    this.showModal     = true;
  }

  addOrigenFromSearch(iata: string) {
    if (!this.origens.includes(iata)) this.origens.push(iata);
  }

  removeOrigen(o: string) {
    this.origens = this.origens.filter(x => x !== o);
  }

  openDetail(alert: Alert) {
    this.selectedAlert = alert;
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
  }

  closeDetail() {
    this.selectedAlert = null;
    this.editingId = null;
  }

  async toggleDetailAlert() {
    if (!this.editingId) return;
    await this.supabase.updateAlert(this.editingId, { ativo: this.form.ativo! });
    if (this.selectedAlert) this.selectedAlert.ativo = this.form.ativo!;
    const a = this.alerts.find(x => x.id === this.editingId);
    if (a) a.ativo = this.form.ativo!;
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

    // Garante que há pelo menos uma origem no modal de novo alerta
    if (!this.editingId && this.origens.length === 0) {
      this.formError = 'Adicione pelo menos uma origem.';
      this.saving = false;
      return;
    }

    const basePayload = {
      destino:         this.form.destino!,
      data_ida:        this.form.data_ida!,
      data_volta:      this.form.so_ida ? null : (this.form.data_volta || null),
      meta:            Number(this.form.meta),
      horario_minimo:  (this.form.horario_minimo && this.form.horario_minimo !== '00:00') ? this.form.horario_minimo : null,
      so_direto:       this.form.so_direto ?? false,
      whatsapp:        '55' + this.form.whatsapp!,
      ativo:           this.editingId ? (this.form.ativo ?? true) : true
    };

    let error;
    if (this.editingId) {
      ({ error } = await this.supabase.updateAlert(this.editingId, { ...basePayload, origem: this.form.origem! }));
    } else {
      for (const origem of this.origens) {
        const result = await this.supabase.createAlert({ ...basePayload, origem } as AlertCreate);
        if (result.error) { error = result.error; break; }
      }
    }

    if (error) {
      this.formError = this.supabase.isSessionError(error)
        ? 'Sua sessão expirou. Faça login novamente.'
        : 'Erro ao salvar alerta. Tente novamente.';
    } else {
      if (this.selectedAlert) {
        this.closeDetail();
      } else {
        this.closeModal();
      }
      await this.loadAlerts();
    }
    this.saving = false;
  }

  async shareAlert(alert: Alert) {
    const url = `${window.location.origin}/share/${alert.id}`;
    await navigator.clipboard.writeText(url);
    this.showToast(`🔗 Link copiado! ${alert.origem} → ${alert.destino}`);
  }

  async toggleAlert(alert: Alert) {
    await this.supabase.updateAlert(alert.id!, { ativo: !alert.ativo });
    alert.ativo = !alert.ativo;
  }

  async confirmDeleteDetail() {
    if (!this.selectedAlert) return;
    if (!confirm(`Excluir alerta ${this.selectedAlert.origem} → ${this.selectedAlert.destino}?`)) return;
    await this.supabase.deleteAlert(this.editingId!);
    this.alerts = this.alerts.filter(a => a.id !== this.editingId);
    this.closeDetail();
  }

  buildGoogleFlightsUrl(alert: Alert | null): string {
    if (!alert) return 'https://www.google.com/travel/flights?hl=pt-BR';
    const query = `voos de ${alert.origem} para ${alert.destino} em ${alert.data_ida}`;
    return 'https://www.google.com/travel/flights?hl=pt-BR&q=' + encodeURIComponent(query);
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
