import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { Alert, AlertCreate } from '@core/models/alert.model';
import { AirportSearchComponent } from '@shared/components/airport-search/airport-search.component';
import { DatePickerComponent } from '@shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { SidebarComponent } from '@shared/components/sidebar/sidebar.component';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';

type JobStatus = { status: string; preco: number | null; link?: string; warning?: string; error?: string };

@Component({
    selector: 'app-voos',
    imports: [CommonModule, FormsModule, AirportSearchComponent, DatePickerComponent, TimePickerComponent, SidebarComponent, ButtonDirective, InputNumber],
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
          @for (t of toasts; track t) {
            <div class="toast fade-up">{{ t }}</div>
          }
        </div>
    
        <!-- ══ LISTA ══ -->
        @if (!selectedAlert) {
          <div class="greeting-header fade-up">
            <div class="greeting-bar"></div>
            <div class="greeting-text">
              <h1>Olá, {{ firstName }}! Qual será sua próxima viagem?</h1>
              @if (!loading) {
                <p class="page-sub">
                  {{ alerts.length }} Rota{{ alerts.length !== 1 ? 's' : '' }} Monitorada{{ alerts.length !== 1 ? 's' : '' }}
                </p>
              }
            </div>
            <div class="greeting-actions">
              <button pButton severity="primary" class="favorite-btn" disabled aria-label="Favoritos" title="Em breve">
                <img src="assets/icons/icon_favorito.png" alt="" />
              </button>
              <button pButton severity="primary" class="new-alert-btn" (click)="openModal()">+ Novo Alerta</button>
            </div>
          </div>
          <div class="content-row">
          <div class="list-column" [class.list-column-narrow]="quickViewAlert">
          <h2 class="list-heading">Voos</h2>
          <!-- Aviso callmebot_key ausente -->
          @if (missingCallmebotKey) {
            <div class="warn-banner fade-up">
              ⚠️ Você ainda não cadastrou sua <strong>CallMeBot API Key</strong>. As notificações não serão enviadas. Acesse <strong>Perfil</strong> na sidebar para configurar.
            </div>
          }
          <!-- Banners de alerta de preço -->
          @for (a of alertsBelowMeta; track a) {
            <div class="price-banner fade-up">
              🔔 Alerta! O voo <strong>{{ a.origem }} → {{ a.destino }}</strong> está abaixo da sua meta —
              R$&nbsp;{{ getMinPrice(a) | number:'1.0-0' }}
              (meta: R$&nbsp;{{ a.meta | number:'1.0-0' }})
            </div>
          }
          <!-- Loading -->
          @if (loading) {
            <div class="center-state">
              <div class="spinner spinner-dark" style="width:28px;height:28px;border-width:3px"></div>
            </div>
          }
          <!-- Empty state -->
          @if (!loading && alerts.length === 0) {
            <div class="empty-state fade-up">
              <img class="empty-icon" src="assets/icons/icon_aviaoSemRotas.png" alt="" />
              <h3>Nenhum alerta ainda</h3>
              <p>Crie seu primeiro alerta e receba no WhatsApp quando o preço cair.</p>
            </div>
          }
          <!-- Alert cards -->
          @if (!loading && alerts.length > 0) {
            <div class="alerts-list">
              @for (alert of alerts; track alert; let i = $index) {
                <div
                  class="alert-card fade-up"
                  [draggable]="true"
                  (dragstart)="onDragStart($event, i)"
                  (dragover)="onDragOver($event, i)"
                  (dragleave)="onDragLeave(i)"
                  (drop)="onDrop($event, i)"
                  (dragend)="onDragEnd()"
                  [style.animation-delay]="(i * 0.04) + 's'"
                  [class.card-inactive]="!alert.ativo"
                  [class.is-dragging]="dragIndex === i"
                  [class.is-drag-over]="dragOverIndex === i && dragIndex !== i"
                  >
                  <span class="drag-handle" title="Arrastar pra reordenar" (pointerdown)="onHandleGrab()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>
                  </span>
                  <div class="card-route">
                    <div class="route-iata">
                      <span class="iata">{{ alert.origem }}</span>
                      <span class="route-sep">→</span>
                      <span class="iata">{{ alert.destino }}</span>
                    </div>
                    <div class="route-date">
                      {{ alert.data_ida | date:'dd/MM/yyyy' }}
                      @if (alert.data_volta) {
                        → {{ alert.data_volta | date:'dd/MM/yyyy' }}
                      }
                      @if (!alert.data_volta) {
                        · Só ida
                      }
                    </div>
                    <div class="route-countdown"
                      [class.countdown-green]="daysUntil(alert.data_ida) > 30"
                      [class.countdown-yellow]="daysUntil(alert.data_ida) >= 7 && daysUntil(alert.data_ida) <= 30"
                      [class.countdown-red]="daysUntil(alert.data_ida) > 0 && daysUntil(alert.data_ida) < 7"
                      [class.countdown-muted]="daysUntil(alert.data_ida) <= 0">
                      @if (daysUntil(alert.data_ida) > 0) {
                        Faltam {{ daysUntil(alert.data_ida) }} dia{{ daysUntil(alert.data_ida) !== 1 ? 's' : '' }}
                      }
                      @if (daysUntil(alert.data_ida) <= 0) {
                        Viagem realizada
                      }
                    </div>
                  </div>
                  <div class="card-price-col">
                    <span class="card-meta-label">Meta: R$&nbsp;{{ alert.meta | number:'1.0-0' }}</span>
                    @if (minPricesLoading && getMinPrice(alert) === null) {
                      <span class="price-skeleton"></span>
                    }
                    @if (!minPricesLoading || getMinPrice(alert) !== null) {
                      <span class="card-price-value"
                        [class.price-below]="getMinPrice(alert) !== null && getMinPrice(alert)! <= alert.meta"
                        [class.price-above]="getMinPrice(alert) !== null && getMinPrice(alert)! > alert.meta"
                        [class.price-muted]="getMinPrice(alert) === null">
                        @if (getMinPrice(alert) !== null) {
                          R$&nbsp;{{ getMinPrice(alert) | number:'1.0-0' }}
                          {{ getMinPrice(alert)! <= alert.meta ? '↓' : '↑' }}
                        }
                        @if (getMinPrice(alert) === null) {
                          —
                        }
                      </span>
                      @if (getMinPrice(alert) !== null) {
                        <span class="card-price-diff"
                          [class.diff-green]="getMinPrice(alert)! <= alert.meta"
                          [class.diff-red]="getMinPrice(alert)! > alert.meta">
                          {{ getMinPrice(alert)! <= alert.meta ? '-' : '+' }}
                          R$&nbsp;{{ absDiff(alert.meta, getMinPrice(alert)!) | number:'1.0-0' }}
                        </span>
                      }
                    }
                  </div>
                  <div class="card-controls">
                    <label class="toggle" [title]="alert.ativo ? 'Pausar' : 'Ativar'">
                      <input type="checkbox" [checked]="alert.ativo" (change)="toggleAlert(alert)" />
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </label>
                    <a [href]="getMinLink(alert)" target="_blank" class="open-btn" title="Abrir oferta">
                      <img src="assets/icons/icon_copy.png" alt="" />
                    </a>
                    <button class="refresh-btn"
                      (click)="refreshPrice(alert)"
                      [title]="getRefreshTitle(alert)"
                      [class.btn-cooldown]="getCooldownSeconds(alert) > 0 && !isRefreshing(alert)">
                      @if (isRefreshing(alert)) {
                        <span class="spinner" style="width:14px;height:14px;border-width:2px"></span>
                      }
                      @if (!isRefreshing(alert)) {
                        @if (getCooldownSeconds(alert) === 0) {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        }
                        @if (getCooldownSeconds(alert) > 0) {
                          <span class="cooldown-label">{{ formatCooldown(alert) }}</span>
                        }
                      }
                    </button>
                    <button class="chevron-btn" [class.active]="quickViewAlert?.id === alert.id" (click)="openQuickView(alert)" title="Ver detalhes">
                    <img src="assets/icons/icon_expandir.png" alt="" />
                  </button>
                  <button class="card-favorite-btn" disabled title="Em breve" aria-label="Favoritar">
                    <img src="assets/icons/icon_favorito.png" alt="" />
                  </button>
                  </div>
                </div>
              }
            </div>
          }
          </div>
          <!-- ══ PAINEL RÁPIDO ══ -->
          @if (quickViewAlert) {
            <aside class="quick-panel fade-up">
              <div class="qp-header">
                <div class="qp-badge">
                  <img src="assets/icons/icon_aviao.png" alt="" />
                </div>
                <div class="qp-route">
                  <img class="qp-route-icon" src="assets/icons/icon_local.png" alt="" />
                  <span>{{ quickViewAlert.origem }}</span>
                  <span class="qp-route-arrow">⟶</span>
                  <span>{{ quickViewAlert.destino }}</span>
                </div>
              </div>
              <div class="qp-body">
              <div class="qp-row">
                <div class="qp-item">
                  <img src="assets/icons/icon_data.png" alt="" />
                  <div>
                    <span class="qp-label">Ida:</span>
                    <span class="qp-value">{{ quickViewAlert.data_ida | date:'dd/MM/yyyy' }}</span>
                  </div>
                </div>
                <div class="qp-item qp-item-noicon">
                  <div>
                    <span class="qp-label">volta:</span>
                    <span class="qp-value">{{ (quickViewAlert.data_volta || quickViewAlert.data_ida) | date:'dd/MM/yyyy' }}</span>
                  </div>
                </div>
              </div>
              <div class="qp-row">
                <div class="qp-item">
                  <img src="assets/icons/icon_preco.png" alt="" />
                  <div>
                    <span class="qp-label">Preço Atual:</span>
                    <span class="qp-value">
                      @if (getMinPrice(quickViewAlert) !== null) {
                        R$&nbsp;{{ getMinPrice(quickViewAlert) | number:'1.0-0' }}
                      }
                      @if (getMinPrice(quickViewAlert) === null) {
                        —
                      }
                    </span>
                  </div>
                </div>
                <div class="qp-item qp-item-noicon">
                  <div>
                    <span class="qp-label">Sua Meta:</span>
                    <span class="qp-value">R$&nbsp;{{ quickViewAlert.meta | number:'1.0-0' }}</span>
                  </div>
                </div>
              </div>
              <div class="qp-item">
                <img src="assets/icons/icon_economia.png" alt="" />
                <div>
                  <span class="qp-label">O quanto você Economiza:</span>
                  <span class="qp-value">R$&nbsp;{{ economia(quickViewAlert) | number:'1.0-0' }}</span>
                </div>
              </div>
              <div class="qp-item">
                <img src="assets/icons/icon_aviao.png" alt="" />
                <div>
                  <span class="qp-label">Companhia Aérea:</span>
                  <span class="qp-value">
                    @if (quickViewLoading) { — }
                    @if (!quickViewLoading) { {{ quickViewDetails?.companhia || 'Não informada' }} }
                  </span>
                </div>
              </div>
              <div class="qp-item">
                <img src="assets/icons/icon_atualizado.png" alt="" />
                <div>
                  <span class="qp-label">Última atualização:</span>
                  <span class="qp-value">
                    @if (quickViewLoading) { — }
                    @if (!quickViewLoading) {
                      {{ quickViewDetails?.atualizado_em ? timeAgo(quickViewDetails!.atualizado_em!) : 'Sem dados' }}
                    }
                  </span>
                </div>
              </div>
              <div class="qp-item">
                <img src="assets/icons/icon_whatsApp.png" alt="" />
                <div>
                  <span class="qp-label">WhatsApp:</span>
                  <span class="qp-value">{{ quickViewAlert.ativo ? 'Ativo' : 'Inativo' }}</span>
                </div>
              </div>
              <div class="qp-actions">
                <button type="button" class="btn-edit" (click)="openDetail(quickViewAlert)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>
                  Editar
                </button>
              </div>
              </div>
            </aside>
          }
          </div>
        }

        <!-- ══ DETALHE ══ -->
        @if (selectedAlert) {
          <div class="detail-view fade-up">
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
                  @if (getMinPrice(selectedAlert) !== null) {
                    R$&nbsp;{{ getMinPrice(selectedAlert) | number:'1.0-0' }}
                  }
                  @if (getMinPrice(selectedAlert) === null && minPricesLoading) {
                    <span class="price-skeleton" style="width:80px;height:28px;display:inline-block"></span>
                  }
                  @if (getMinPrice(selectedAlert) === null && !minPricesLoading) {
                    —
                  }
                </span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Preço atual</span>
                <span class="stat-value"
                  [class.stat-green]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! <= selectedAlert.meta"
                  [class.stat-red]="getMinPrice(selectedAlert) !== null && getMinPrice(selectedAlert)! > selectedAlert.meta">
                  @if (getMinPrice(selectedAlert) !== null) {
                    R$&nbsp;{{ getMinPrice(selectedAlert) | number:'1.0-0' }}
                  }
                  @if (getMinPrice(selectedAlert) === null) {
                    —
                  }
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
                      <p-inputNumber inputId="d-meta" [(ngModel)]="form.meta" name="d_meta"
                        placeholder="3000" [min]="1" [required]="true" [showButtons]="true" styleClass="meta-input" />
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
                          <span class="info-label">Abrir oferta</span>
                          <a class="open-btn" [href]="getMinLink(selectedAlert)" target="_blank" rel="noopener" title="Abrir oferta">↗</a>
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
                  @if (formError) {
                    <div class="error-box" style="margin-top:4px">{{ formError }}</div>
                  }
                  <div class="detail-actions">
                    <button type="button" class="btn-danger" (click)="confirmDeleteDetail()">Excluir alerta</button>
                    <button type="submit" class="btn-primary" [disabled]="saving">
                      @if (saving) {
                        <span class="spinner"></span>
                      }
                      @if (!saving) {
                        <span>Salvar alterações</span>
                      }
                    </button>
                  </div>
                </form>
              </div>
            }
    
          </main>
    
          <!-- ── Modal novo alerta ── -->
          @if (showModal) {
            <div class="modal-overlay" (click)="onOverlayClick($event)">
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
                        @for (o of origens; track o) {
                          <span class="chip">
                            {{ o }}
                            <button type="button" class="chip-remove" (click)="removeOrigen(o)">×</button>
                          </span>
                        }
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
                      <p-inputNumber inputId="m-meta" [(ngModel)]="form.meta" name="meta"
                        placeholder="3000" [min]="1" [required]="true" [showButtons]="true" styleClass="meta-input" />
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
                      @if (formError) {
                        <div class="error-box" style="margin-top:14px">{{ formError }}</div>
                      }
                      <div class="modal-actions">
                        <button type="button" class="btn-ghost" (click)="closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary modal-save" [disabled]="saving">
                          @if (saving) {
                            <span class="spinner"></span>
                          }
                          @if (!saving) {
                            <span>
                              Salvar{{ origens.length > 1 ? ' ' + origens.length + ' alertas' : ' alerta' }}
                            </span>
                          }
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              }
    
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

  quickViewAlert: Alert | null = null;
  quickViewLoading = false;
  quickViewDetails: { companhia: string | null; atualizado_em: string | null } | null = null;

  missingCallmebotKey = false;
  profileWhatsapp     = '';
  profileNome         = '';

  minPrices:        Record<string, number> = {};
  minLinks:         Record<string, string> = {};
  minPricesLoading  = false;
  refreshing:       Record<string, boolean> = {};
  toasts:           string[] = [];
  private realtimeChannel: any;
  private realtimeDebounce: any;
  private cooldownTick: any;
  private cooldownNow = Date.now();
  private readonly COOLDOWN_MS = 30 * 60 * 1000;

  isDark = true;

  origens: string[] = [];
  origenInput = '';

  form: Partial<Alert & { so_ida: boolean }> = this.emptyForm();
  readonly today = new Date().toISOString().split('T')[0];

  get activeCount() { return this.alerts.filter(a => a.ativo).length; }

  get firstName(): string {
    if (this.profileNome) return this.profileNome.split(' ')[0];
    const local = this.userEmail.split('@')[0] || '';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  get alertsBelowMeta(): Alert[] {
    return this.alerts.filter(a => {
      const p = this.getMinPrice(a);
      return p !== null && p <= a.meta;
    });
  }

  constructor(
      private supabase: SupabaseService,
      public router: Router,
      private ngZone: NgZone
  ) {}

  async ngOnInit() {
    this.isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    const [user, profileResult] = await Promise.all([
      this.supabase.getUser(),
      this.supabase.getProfile()
    ]);
    const profile = profileResult.data;
    this.userEmail           = user?.email ?? '';
    this.missingCallmebotKey = !profile?.callmebot_key;
    this.profileWhatsapp     = this.stripPrefix(profile?.whatsapp ?? '');
    this.profileNome         = profile?.nome ?? '';
    await this.loadAlerts();

    // Uma coleta salva dezenas de linhas em price_cache (DELETE + INSERT em
    // lote), e cada linha dispara um evento de realtime separado. Sem o
    // debounce, isso rodava loadMinPrices() (2 queries por alerta) dezenas de
    // vezes em rajada a cada atualizacao, causando os precos "piscando" na
    // tela (#138). Espera 1s de silencio antes de recarregar.
    this.realtimeChannel = this.supabase.subscribePriceCache(() => {
      clearTimeout(this.realtimeDebounce);
      this.realtimeDebounce = setTimeout(() => this.aplicarAtualizacaoDePrecos(), 1000);
    });
    this.cooldownTick = setInterval(() => { this.cooldownNow = Date.now(); }, 1000);
  }

  private async aplicarAtualizacaoDePrecos() {
    const prevPrices = { ...this.minPrices };
    await this.loadMinPrices();
    for (const alert of this.alerts) {
      const key = this.priceKey(alert);
      const prev = prevPrices[key];
      const curr = this.minPrices[key];
      if (curr !== undefined && curr <= alert.meta && (prev === undefined || prev > alert.meta)) {
        this.showToast(`✈ ${alert.origem} → ${alert.destino} abaixo da meta! R$ ${curr}`);
      }
    }
  }

  ngOnDestroy() {
    this.realtimeChannel?.unsubscribe();
    clearTimeout(this.realtimeDebounce);
    clearInterval(this.cooldownTick);
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

  // ── Reordenar cards (drag-and-drop nativo do HTML5) ──────────
  // Sem Angular CDK: o proprio navegador desenha o "fantasma" do card
  // enquanto arrasta, entao nao ha preview posicionado por CSS pra dar
  // errado. So arrasta quem pegou pela alca (handleGrabbed) - assim os
  // botoes e o link do card continuam clicaveis normalmente.
  dragIndex: number | null = null;
  dragOverIndex: number | null = null;
  private handleGrabbed = false;

  onHandleGrab() {
    this.handleGrabbed = true;
  }

  onDragStart(event: DragEvent, index: number) {
    if (!this.handleGrabbed) {
      event.preventDefault();
      return;
    }
    this.dragIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, index: number) {
    if (this.dragIndex === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverIndex = index;
  }

  onDragLeave(index: number) {
    if (this.dragOverIndex === index) this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    const from = this.dragIndex;
    this.resetDrag();
    if (from === null || from === index) return;

    const reordenados = [...this.alerts];
    const [movido] = reordenados.splice(from, 1);
    reordenados.splice(index, 0, movido);
    this.alerts = reordenados;

    this.supabase.reorderAlerts(reordenados.map(a => a.id!)).catch(err => {
      console.warn('Falha ao salvar nova ordem dos alertas:', err);
    });
  }

  onDragEnd() {
    this.resetDrag();
  }

  private resetDrag() {
    this.dragIndex = null;
    this.dragOverIndex = null;
    this.handleGrabbed = false;
  }

  async loadMinPrices() {
    if (!this.alerts.length) return;
    this.minPricesLoading = true;
    const prices: Record<string, number> = {};
    const links: Record<string, string> = {};
    await Promise.all(
      this.alerts.map(async (alert) => {
        const key = this.priceKey(alert);
        if (prices[key] === undefined) {
          const { preco: price, link } = await this.supabase.getMinPriceRowForRoute(
            alert.origem, alert.destino, alert.data_ida,
            alert.data_volta ?? null,
            { horarioMinimo: alert.horario_minimo, soDireto: alert.so_direto }
          );
          if (price !== null) prices[key] = price;
          if (link !== null) links[key] = link;
        }
      })
    );
    this.minPrices = prices;
    this.minLinks = links;
    this.minPricesLoading = false;
  }

  absDiff(a: number, b: number): number { return Math.abs(a - b); }

  daysUntil(date: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(date + 'T00:00:00');
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  getMinPrice(alert: Alert): number | null {
    const val = this.minPrices[this.priceKey(alert)];
    return val !== undefined ? val : null;
  }

  getMinLink(alert: Alert | null): string {
    if (!alert) return this.buildGoogleFlightsUrl(alert);
    return this.minLinks[this.priceKey(alert)] ?? this.buildGoogleFlightsUrl(alert);
  }

  private readonly JOB_POLL_INTERVAL_MS = 4000;
  private readonly JOB_POLL_MAX_ATTEMPTS = 150; // ~10 minutos - o worker processa 1 job por vez, entao varios refreshes simultaneos ficam na fila

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Roda fora da zone do Angular: o polling faz varios ciclos de espera/fetch
  // (ate ~2min) e, sem isso, cada tick disparava change detection na tela
  // inteira (todos os cards recalculando classes/valores), causando um
  // "piscar" visivel em todos os alertas enquanto um so estava atualizando.
  private pollJobStatus(jobId: string): Promise<JobStatus | null> {
    return this.ngZone.runOutsideAngular(async () => {
      for (let tentativa = 0; tentativa < this.JOB_POLL_MAX_ATTEMPTS; tentativa++) {
        await this.sleep(this.JOB_POLL_INTERVAL_MS);
        const job = await this.supabase.getJobStatus(jobId);
        if (job.status === 'done' || job.status === 'error') return job;
      }
      return null;
    });
  }

  async refreshPrice(alert: Alert) {
    if (!alert.id || this.isRefreshing(alert)) return;

    // Dentro da janela de cooldown, nao enfileira coleta nova - so mostra
    // de novo o preco que ja esta em cache (evita gastar coleta a toa
    // quando o preco provavelmente ainda nao mudou).
    if (this.getCooldownSeconds(alert) > 0) {
      const { preco: currentPrice, link: currentLink } = await this.supabase.getMinPriceRowForRoute(
        alert.origem, alert.destino, alert.data_ida,
        alert.data_volta ?? null,
        { horarioMinimo: alert.horario_minimo, soDireto: alert.so_direto }
      );
      if (currentPrice !== null) {
        this.minPrices = { ...this.minPrices, [this.priceKey(alert)]: currentPrice };
        if (currentLink !== null) {
          this.minLinks = { ...this.minLinks, [this.priceKey(alert)]: currentLink };
        }
      }
      return;
    }

    this.refreshing = { ...this.refreshing, [alert.id]: true };
    try {
      // Se algo falhar daqui pra frente (nao enfileirou, demorou demais,
      // job deu erro), nao mostramos toast nenhum: o preco que ja estava
      // na tela (do carregamento anterior) continua valendo. O usuario
      // nunca fica olhando pra uma mensagem de erro tecnica.
      const key = this.refreshKey(alert);
      const { jobId } = await this.supabase.enqueueFlightRefresh(
        alert.origem, alert.destino, alert.data_ida, alert.data_volta
      );

      if (!jobId) return;

      const job = await this.pollJobStatus(jobId);
      if (!job || job.status === 'error' || job.preco === null) return;

      await this.ngZone.run(async () => {
        const { preco: currentPrice, link: currentLink } = await this.supabase.getMinPriceRowForRoute(
          alert.origem, alert.destino, alert.data_ida,
          alert.data_volta ?? null,
          { horarioMinimo: alert.horario_minimo, soDireto: alert.so_direto }
        );

        localStorage.setItem(key, String(Date.now()));
        if (currentPrice !== null) {
          this.minPrices = { ...this.minPrices, [this.priceKey(alert)]: currentPrice };
          if (currentLink !== null) {
            this.minLinks = { ...this.minLinks, [this.priceKey(alert)]: currentLink };
          }
          this.showToast(`Preço atualizado: R$ ${currentPrice}`);
        } else {
          await this.loadMinPrices();
          this.showToast(`Coleta atualizada: menor preço encontrado R$ ${job.preco}, mas nenhum voo passou nos filtros deste alerta.`);
        }
      });
    } finally {
      this.refreshing = { ...this.refreshing, [alert.id]: false };
    }
  }

  isRefreshing(alert: Alert): boolean {
    return !!(alert.id && this.refreshing[alert.id]);
  }

  getCooldownSeconds(alert: Alert): number {
    const last = Number(localStorage.getItem(this.refreshKey(alert)) ?? 0);
    const remaining = this.COOLDOWN_MS - (this.cooldownNow - last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  formatCooldown(alert: Alert): string {
    const secs = this.getCooldownSeconds(alert);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getRefreshTitle(alert: Alert): string {
    if (this.isRefreshing(alert)) return 'Atualizando...';
    const secs = this.getCooldownSeconds(alert);
    if (secs > 0) return `Disponível em ${this.formatCooldown(alert)}`;
    return 'Atualizar preço agora';
  }

  onProfileSaved(event: { whatsapp: string; nome: string }) {
    if (event.whatsapp) this.profileWhatsapp = event.whatsapp;
    this.profileNome = event.nome;
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

  async openQuickView(alert: Alert) {
    if (this.quickViewAlert?.id === alert.id) {
      this.closeQuickView();
      return;
    }
    this.quickViewAlert   = alert;
    this.quickViewDetails = null;
    this.quickViewLoading = true;
    const details = await this.supabase.getMinPriceDetailsForRoute(
      alert.origem, alert.destino, alert.data_ida,
      alert.data_volta ?? null,
      { horarioMinimo: alert.horario_minimo, soDireto: alert.so_direto }
    );
    this.quickViewDetails = details
      ? { companhia: details.companhia, atualizado_em: details.atualizado_em }
      : { companhia: null, atualizado_em: null };
    this.quickViewLoading = false;
  }

  closeQuickView() {
    this.quickViewAlert   = null;
    this.quickViewDetails = null;
  }

  economia(alert: Alert): number {
    const price = this.getMinPrice(alert);
    if (price === null || price > alert.meta) return 0;
    return alert.meta - price;
  }

  timeAgo(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `Há ${mins} minuto${mins !== 1 ? 's' : ''}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours} hora${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `Há ${days} dia${days !== 1 ? 's' : ''}`;
  }

  openDetail(alert: Alert) {
    this.closeQuickView();
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
    const query = alert.data_volta
      ? `${alert.origem} to ${alert.destino} ${alert.data_ida} ${alert.data_volta}`
      : `${alert.origem} to ${alert.destino} ${alert.data_ida}`;
    return 'https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=' + encodeURIComponent(query);
  }

  private refreshKey(alert: Alert): string {
    return `flight_refresh_${alert.origem}_${alert.destino}_${alert.data_ida}_${alert.data_volta ?? 'ida'}`;
  }

  private priceKey(alert: Alert): string {
    return `${alert.origem}-${alert.destino}-${alert.data_ida}-${alert.data_volta ?? 'ida'}`;
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
