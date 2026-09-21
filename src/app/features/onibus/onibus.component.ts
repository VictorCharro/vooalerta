import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { DatePickerComponent } from '@shared/components/date-picker/date-picker.component';
import { SidebarComponent } from '@shared/components/sidebar/sidebar.component';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';

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
    imports: [CommonModule, FormsModule, DatePickerComponent, SidebarComponent, ButtonDirective, InputNumber],
    styleUrls: ['./onibus.component.css'],
    template: `
    <div class="layout">
    
      <app-sidebar active="onibus" [userEmail]="userEmail" [isDark]="isDark"
        (themeChange)="isDark = $event"
        (profileSaved)="onProfileSaved($event)">
      </app-sidebar>
    
      <!-- ── Main ── -->
      <main class="main">
    
        <div class="toast-container">
          @for (t of toasts; track t) {
            <div class="toast fade-up">{{ t }}</div>
          }
        </div>
    
        <!-- ══ LISTA ══ -->
        @if (!selectedAlert) {
          <!-- Banners abaixo da meta -->
          @for (a of alertsBelowMeta; track a) {
            <div class="price-banner fade-up">
              Ônibus <strong>{{ a.origem }} → {{ a.destino }}</strong> abaixo da meta —
              R$&nbsp;{{ getCachedPrice(a) | number:'1.0-0' }}
              (meta: R$&nbsp;{{ a.meta | number:'1.0-0' }})
            </div>
          }
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
          <div class="list-column">
          <h2 class="list-heading">Ônibus</h2>
          <!-- Loading -->
          @if (loading) {
            <div class="center-state">
              <div class="spinner spinner-dark" style="width:28px;height:28px;border-width:3px"></div>
            </div>
          }
          <!-- Empty state -->
          @if (!loading && alerts.length === 0) {
            <div class="empty-state fade-up">
              <img class="empty-icon" src="assets/icons/icon_onibus.png" alt="" />
              <h3>Nenhum alerta de ônibus</h3>
              <p>Crie um alerta e receba no WhatsApp quando a passagem cair.</p>
            </div>
          }
          <!-- Cards de alertas -->
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
                      <span class="city-name">{{ alert.origem }}</span>
                      <span class="route-sep">→</span>
                      <span class="city-name">{{ alert.destino }}</span>
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
                    @if (pricesLoading && getCachedPrice(alert) === null) {
                      <span class="price-skeleton"></span>
                    }
                    @if (!pricesLoading || getCachedPrice(alert) !== null) {
                      <span class="card-price-value"
                        [class.price-below]="getCachedPrice(alert) !== null && getCachedPrice(alert)! <= alert.meta"
                        [class.price-above]="getCachedPrice(alert) !== null && getCachedPrice(alert)! > alert.meta"
                        [class.price-muted]="getCachedPrice(alert) === null">
                        @if (getCachedPrice(alert) !== null) {
                          R$&nbsp;{{ getCachedPrice(alert) | number:'1.0-0' }}
                          {{ getCachedPrice(alert)! <= alert.meta ? '↓' : '↑' }}
                        }
                        @if (getCachedPrice(alert) === null) {
                          —
                        }
                      </span>
                      @if (getCachedPrice(alert) !== null) {
                        <span class="card-price-diff"
                          [class.diff-green]="getCachedPrice(alert)! <= alert.meta"
                          [class.diff-red]="getCachedPrice(alert)! > alert.meta">
                          {{ getCachedPrice(alert)! <= alert.meta ? '-' : '+' }}
                          R$&nbsp;{{ absDiff(alert.meta, getCachedPrice(alert)!) | number:'1.0-0' }}
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
                    <a [href]="buildBuserUrl(alert)" target="_blank" rel="noopener" class="open-btn" title="Abrir no Buser">
                      <img src="assets/icons/icon_copy.png" alt="" />
                    </a>
                    <button class="share-btn"
                      (click)="refreshPrice(alert)"
                      [title]="getRefreshTitle(alert)"
                      [class.btn-cooldown]="getCooldownSeconds(alert) > 0 && !refreshing[alert.id]">
                      @if (refreshing[alert.id]) {
                        <span class="spinner" style="width:14px;height:14px;border-width:2px"></span>
                      }
                      @if (!refreshing[alert.id]) {
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
                  <img src="assets/icons/icon_onibus.png" alt="" />
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
                      @if (getCachedPrice(quickViewAlert) !== null) {
                        R$&nbsp;{{ getCachedPrice(quickViewAlert) | number:'1.0-0' }}
                      }
                      @if (getCachedPrice(quickViewAlert) === null) {
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
            <!-- Stat cards -->
            <div class="stat-grid">
              <div class="stat-card">
                <span class="stat-label">Menor preço</span>
                <span class="stat-value"
                  [class.stat-green]="getCachedPrice(selectedAlert) !== null && getCachedPrice(selectedAlert)! <= selectedAlert.meta"
                  [class.stat-red]="getCachedPrice(selectedAlert) !== null && getCachedPrice(selectedAlert)! > selectedAlert.meta">
                  @if (getCachedPrice(selectedAlert) !== null) {
                    R$&nbsp;{{ getCachedPrice(selectedAlert) | number:'1.0-0' }}
                  }
                  @if (getCachedPrice(selectedAlert) === null) {
                    —
                  }
                </span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Preço atual</span>
                <span class="stat-value"
                  [class.stat-green]="getCachedPrice(selectedAlert) !== null && getCachedPrice(selectedAlert)! <= selectedAlert.meta"
                  [class.stat-red]="getCachedPrice(selectedAlert) !== null && getCachedPrice(selectedAlert)! > selectedAlert.meta">
                  @if (getCachedPrice(selectedAlert) !== null) {
                    R$&nbsp;{{ getCachedPrice(selectedAlert) | number:'1.0-0' }}
                  }
                  @if (getCachedPrice(selectedAlert) === null) {
                    —
                  }
                </span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Sua meta</span>
                <span class="stat-value">R$&nbsp;{{ selectedAlert.meta | number:'1.0-0' }}</span>
              </div>
            </div>
            <!-- Formulário de edição -->
            <form (ngSubmit)="saveDetail()">
              <div class="detail-grid">
                <!-- Esquerda: campos da rota -->
                <div class="info-section">
                  <h3 class="section-title">Detalhes da rota</h3>
                  <div class="form-row">
                    <div class="form-group">
                      <label>Cidade de origem</label>
                      <input [(ngModel)]="detailForm.origem" name="d_origem" placeholder="Ex: Franca" required />
                    </div>
                    <div class="form-group" style="max-width:80px">
                      <label>UF</label>
                      <input class="uf-input" [(ngModel)]="detailForm.origem_uf" name="d_origem_uf" maxlength="2" required
                        (input)="detailForm.origem_uf = detailForm.origem_uf.toUpperCase()" />
                      </div>
                    </div>
                    <div class="form-row" style="margin-top:14px">
                      <div class="form-group">
                        <label>Cidade de destino</label>
                        <input [(ngModel)]="detailForm.destino" name="d_destino" placeholder="Ex: São Paulo" required />
                      </div>
                      <div class="form-group" style="max-width:80px">
                        <label>UF</label>
                        <input class="uf-input" [(ngModel)]="detailForm.destino_uf" name="d_destino_uf" maxlength="2" required
                          (input)="detailForm.destino_uf = detailForm.destino_uf.toUpperCase()" />
                        </div>
                      </div>
                      <div class="form-row" style="margin-top:14px">
                        <div class="form-group">
                          <label>Data de ida</label>
                          <app-date-picker
                            [value]="detailForm.data_ida"
                            [min]="today"
                            placeholder="Selecionar data"
                            (valueChange)="detailForm.data_ida = $event">
                          </app-date-picker>
                        </div>
                        <div class="form-group">
                          <label>Data de volta <span class="form-optional">(opcional)</span></label>
                          <app-date-picker
                            [value]="detailForm.data_volta"
                            [min]="detailForm.data_ida || today"
                            placeholder="Selecionar data"
                            (valueChange)="detailForm.data_volta = $event">
                          </app-date-picker>
                        </div>
                      </div>
                      <div class="form-row" style="margin-top:14px">
                        <div class="form-group">
                          <label for="d-meta">Meta de preço (R$)</label>
                          <p-inputNumber inputId="d-meta" [(ngModel)]="detailForm.meta" name="d_meta" placeholder="150" [min]="1" [required]="true" [showButtons]="true" styleClass="meta-input" />
                        </div>
                        <div class="form-group">
                          <label for="d-whatsapp">WhatsApp</label>
                          <div class="phone-input">
                            <span class="phone-prefix">55</span>
                            <input id="d-whatsapp" type="tel" [(ngModel)]="detailForm.whatsapp" name="d_whatsapp"
                              placeholder="11999999999" maxlength="11" required />
                            </div>
                            <span class="form-hint">DDD + número (ex: 11999999999)</span>
                          </div>
                        </div>
                      </div>
                      <!-- Direita: info + configurações -->
                      <div class="detail-right">
                        <div class="info-section">
                          <h3 class="section-title">Informações da passagem</h3>
                          <div class="info-row">
                            <span class="info-label">Operadora</span>
                            <span class="info-value">Buser</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Tipo</span>
                            <span class="info-value">Qualquer assento</span>
                          </div>
                          <div class="info-row" style="border-bottom:none;padding-bottom:0">
                            <span class="info-label">Abrir no Buser</span>
                            <a class="open-btn" [href]="buildBuserUrl(selectedAlert)" target="_blank" rel="noopener" title="Abrir no Buser">↗</a>
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
                              <input type="checkbox" [(ngModel)]="detailForm.ativo" name="d_ativo" (change)="toggleDetailAlert()" />
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
                <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="bus-modal-title">
                  <div class="modal-head">
                    <h2 id="bus-modal-title">Novo alerta de ônibus</h2>
                    <button class="btn-icon" (click)="closeModal()" aria-label="Fechar">✕</button>
                  </div>
                  <form (ngSubmit)="saveAlert()">
                    <div class="form-row" style="align-items:flex-start">
                      <div class="form-group">
                        <label>Cidade de origem</label>
                        <input [(ngModel)]="form.origem" name="origem" placeholder="Ex: Franca" required
                          (blur)="validateCity('origem')" />
                          @if (cityError['origem']) {
                            <span class="city-error">{{ cityError['origem'] }}</span>
                          }
                          @if (cityChecking['origem']) {
                            <span class="form-hint">Verificando...</span>
                          }
                        </div>
                        <div class="form-group" style="max-width:80px">
                          <label>UF</label>
                          <input class="uf-input" [(ngModel)]="form.origem_uf" name="origem_uf" placeholder="SP" maxlength="2" required
                            (input)="form.origem_uf = form.origem_uf.toUpperCase()"
                            (blur)="validateCity('origem')" />
                          </div>
                        </div>
                        <div class="form-row" style="align-items:flex-start;margin-top:14px">
                          <div class="form-group">
                            <label>Cidade de destino</label>
                            <input [(ngModel)]="form.destino" name="destino" placeholder="Ex: São Paulo" required
                              (blur)="validateCity('destino')" />
                              @if (cityError['destino']) {
                                <span class="city-error">{{ cityError['destino'] }}</span>
                              }
                              @if (cityChecking['destino']) {
                                <span class="form-hint">Verificando...</span>
                              }
                            </div>
                            <div class="form-group" style="max-width:80px">
                              <label>UF</label>
                              <input class="uf-input" [(ngModel)]="form.destino_uf" name="destino_uf" placeholder="SP" maxlength="2" required
                                (input)="form.destino_uf = form.destino_uf.toUpperCase()"
                                (blur)="validateCity('destino')" />
                              </div>
                            </div>
                            <div class="form-row" style="margin-top:14px">
                              <div class="form-group">
                                <label for="bus-meta">Meta de preço (R$)</label>
                                <p-inputNumber inputId="bus-meta" [(ngModel)]="form.meta" name="meta"
                                  placeholder="150" [min]="1" [required]="true" [showButtons]="true" styleClass="meta-input" />
                                </div>
                                <div class="form-group">
                                  <label for="bus-whatsapp">WhatsApp</label>
                                  <div class="phone-input">
                                    <span class="phone-prefix">55</span>
                                    <input id="bus-whatsapp" type="tel" [(ngModel)]="form.whatsapp" name="whatsapp"
                                      placeholder="11999999999" maxlength="11" required />
                                    </div>
                                    <span class="form-hint">DDD + número (ex: 11999999999)</span>
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
                                      <span>Salvar alerta</span>
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
export class OnibusComponent implements OnInit, OnDestroy {
  alerts: BusAlert[] = [];
  loading      = true;
  showModal    = false;
  saving       = false;
  formError    = '';
  userEmail    = '';
  isDark       = true;
  toasts:      string[] = [];
  cachedPrices: Record<string, number> = {};
  pricesLoading = false;
  refreshing:   Record<string, boolean> = {};
  selectedAlert: BusAlert | null = null;

  quickViewAlert: BusAlert | null = null;
  quickViewLoading = false;
  quickViewDetails: { atualizado_em: string | null } | null = null;

  dragIndex: number | null = null;
  dragOverIndex: number | null = null;
  private handleGrabbed = false;

  private profileWhatsapp = '';
  private profileNome = '';
  private realtimeChannel: any;
  private cooldownTick: any;
  private cooldownNow = Date.now();
  private readonly COOLDOWN_MS = 10 * 60 * 1000;
  cityError: Record<string, string> = {};
  cityChecking: Record<string, boolean> = {};


  form       = this.emptyForm();
  detailForm = this.emptyDetailForm();
  readonly today = new Date().toISOString().split('T')[0];

  get firstName(): string {
    if (this.profileNome) return this.profileNome.split(' ')[0];
    const local = this.userEmail.split('@')[0] || '';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  get alertsBelowMeta(): BusAlert[] {
    return this.alerts.filter(a => {
      const p = this.getCachedPrice(a);
      return p !== null && p <= a.meta;
    });
  }

  constructor(public router: Router, private supabase: SupabaseService) {}

  async ngOnInit() {
    this.isDark = (localStorage.getItem('theme') ?? 'dark') === 'dark';
    const [user, profileResult] = await Promise.all([
      this.supabase.getUser(),
      this.supabase.getProfile()
    ]);
    const profile = profileResult.data;
    this.userEmail       = user?.email ?? '';
    this.profileWhatsapp = this.stripPrefix(profile?.whatsapp ?? '');
    this.profileNome     = profile?.nome ?? '';
    await this.loadAlerts();
    this.realtimeChannel = this.supabase.subscribeBusPriceCache(async () => {
      await this.loadCachedPrices();
    });
    // tick a cada segundo para atualizar o countdown
    this.cooldownTick = setInterval(() => { this.cooldownNow = Date.now(); }, 1000);
  }

  ngOnDestroy() {
    this.realtimeChannel?.unsubscribe();
    clearInterval(this.cooldownTick);
  }

  async loadAlerts() {
    this.loading = true;
    const { data } = await this.supabase.getBusAlerts();
    this.alerts  = (data as BusAlert[]) ?? [];
    this.loading = false;
    await this.loadCachedPrices();
  }

  async loadCachedPrices() {
    if (!this.alerts.length) return;
    this.pricesLoading = true;
    const prices: Record<string, number> = {};
    await Promise.all(
      this.alerts.map(async (a) => {
        const key = this.priceKey(a);
        if (prices[key] === undefined) {
          const p = await this.supabase.getBusCachedPrice(a.origem_slug, a.destino_slug, a.data_ida);
          if (p !== null) prices[key] = p;
        }
      })
    );
    this.cachedPrices = prices;
    this.pricesLoading = false;
  }

  async refreshPrice(alert: BusAlert) {
    if (this.refreshing[alert.id] || this.getCooldownSeconds(alert) > 0) return;
    this.refreshing = { ...this.refreshing, [alert.id]: true };
    const key = `bus_refresh_${alert.origem_slug}_${alert.destino_slug}_${alert.data_ida}`;
    const p = await this.supabase.scrapeBuserPrice(alert.origem_slug, alert.destino_slug, alert.data_ida, alert.data_volta);
    localStorage.setItem(key, String(Date.now()));
    if (p !== null) {
      this.cachedPrices = { ...this.cachedPrices, [this.priceKey(alert)]: p };
      this.showToast(`Preço atualizado: R$ ${p}`);
    } else {
      this.showToast('Rota não encontrada ou sem passagens disponíveis.');
    }
    this.refreshing = { ...this.refreshing, [alert.id]: false };
  }

  getCooldownSeconds(alert: BusAlert): number {
    const key = `bus_refresh_${alert.origem_slug}_${alert.destino_slug}_${alert.data_ida}`;
    const last = Number(localStorage.getItem(key) ?? 0);
    const remaining = this.COOLDOWN_MS - (this.cooldownNow - last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  formatCooldown(alert: BusAlert): string {
    const secs = this.getCooldownSeconds(alert);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getRefreshTitle(alert: BusAlert): string {
    if (this.refreshing[alert.id]) return 'Atualizando...';
    const secs = this.getCooldownSeconds(alert);
    if (secs > 0) return `Disponível em ${this.formatCooldown(alert)}`;
    return 'Atualizar preço agora';
  }

  priceKey(a: BusAlert) { return `${a.origem_slug}-${a.destino_slug}-${a.data_ida}`; }

  getCachedPrice(alert: BusAlert): number | null {
    const val = this.cachedPrices[this.priceKey(alert)];
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

  async validateCity(field: 'origem' | 'destino') {
    const cidade = field === 'origem' ? this.form.origem : this.form.destino;
    const uf = field === 'origem' ? this.form.origem_uf : this.form.destino_uf;
    if (!cidade || !uf || uf.length < 2) return;
    const slug = this.toSlug(cidade) + '-' + uf.toLowerCase();
    this.cityChecking = { ...this.cityChecking, [field]: true };
    this.cityError = { ...this.cityError, [field]: '' };
    const valido = await this.supabase.validateBuserCity(slug);
    this.cityChecking = { ...this.cityChecking, [field]: false };
    if (!valido) {
      this.cityError = { ...this.cityError, [field]: `"${cidade} - ${uf.toUpperCase()}" não encontrada no Buser.` };
    }
  }

  toTitleCase(text: string): string {
    return text.trim().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  // ── Lista ──────────────────────────────────────────────────

  openModal() {
    this.form          = this.emptyForm();
    this.form.whatsapp = this.profileWhatsapp;
    this.formError     = '';
    this.cityError     = {};
    this.cityChecking  = {};
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
      this.saving = false; return;
    }
    if (this.form.origem_uf.length < 2 || this.form.destino_uf.length < 2) {
      this.formError = 'UF deve ter 2 letras (ex: SP).';
      this.saving = false; return;
    }
    // Valida as cidades no Buser antes de salvar
    await Promise.all([this.validateCity('origem'), this.validateCity('destino')]);
    if (this.cityError['origem'] || this.cityError['destino']) {
      this.formError = 'Uma ou mais cidades não foram encontradas no Buser.';
      this.saving = false; return;
    }
    if (!this.form.data_ida || this.form.data_ida < this.today) {
      this.formError = 'Data de ida inválida.';
      this.saving = false; return;
    }
    if ((this.form.whatsapp ?? '').replace(/\D/g, '').length !== 11) {
      this.formError = 'WhatsApp inválido. Digite DDD + número (11 dígitos).';
      this.saving = false; return;
    }

    const { error } = await this.supabase.createBusAlert({
      origem:       this.toTitleCase(this.form.origem),
      origem_slug:  this.toSlug(this.form.origem) + '-' + this.form.origem_uf.toLowerCase(),
      destino:      this.toTitleCase(this.form.destino),
      destino_slug: this.toSlug(this.form.destino) + '-' + this.form.destino_uf.toLowerCase(),
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

  // ── Painel rápido (ver detalhes) ────────────────────────────

  async openQuickView(alert: BusAlert) {
    if (this.quickViewAlert?.id === alert.id) {
      this.closeQuickView();
      return;
    }
    this.quickViewAlert   = alert;
    this.quickViewDetails = null;
    this.quickViewLoading = true;
    const details = await this.supabase.getBusCachedPriceDetails(alert.origem_slug, alert.destino_slug, alert.data_ida);
    this.quickViewDetails = { atualizado_em: details?.atualizado_em ?? null };
    this.quickViewLoading = false;
  }

  closeQuickView() {
    this.quickViewAlert   = null;
    this.quickViewDetails = null;
  }

  economia(alert: BusAlert): number {
    const price = this.getCachedPrice(alert);
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

  // ── Arrastar pra reordenar ───────────────────────────────────

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

    this.supabase.reorderBusAlerts(reordenados.map(a => a.id)).catch(err => {
      console.warn('Falha ao salvar nova ordem dos alertas de ônibus:', err);
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

  // ── Detail ─────────────────────────────────────────────────

  openDetail(alert: BusAlert) {
    this.closeQuickView();
    this.selectedAlert = alert;
    const ufFromSlug = (slug: string) => slug.split('-').pop()?.toUpperCase() ?? '';
    const cityFromSlug = (slug: string) => {
      const parts = slug.split('-');
      parts.pop();
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    };
    this.detailForm = {
      origem:      alert.origem,
      origem_uf:   ufFromSlug(alert.origem_slug),
      destino:     alert.destino,
      destino_uf:  ufFromSlug(alert.destino_slug),
      data_ida:    alert.data_ida,
      data_volta:  alert.data_volta ?? '',
      meta:        alert.meta,
      whatsapp:    this.stripPrefix(alert.whatsapp),
      ativo:       alert.ativo
    };
    this.formError = '';
  }

  closeDetail() { this.selectedAlert = null; }

  async toggleDetailAlert() {
    if (!this.selectedAlert) return;
    await this.supabase.updateBusAlert(this.selectedAlert.id, { ativo: this.detailForm.ativo });
    this.selectedAlert.ativo = this.detailForm.ativo;
    const a = this.alerts.find(x => x.id === this.selectedAlert!.id);
    if (a) a.ativo = this.detailForm.ativo;
  }

  async saveDetail() {
    this.saving    = true;
    this.formError = '';

    if (!this.detailForm.origem || !this.detailForm.origem_uf || !this.detailForm.destino || !this.detailForm.destino_uf) {
      this.formError = 'Preencha cidade e UF de origem e destino.';
      this.saving = false; return;
    }
    if ((this.detailForm.whatsapp ?? '').replace(/\D/g, '').length !== 11) {
      this.formError = 'WhatsApp inválido.';
      this.saving = false; return;
    }

    const { error } = await this.supabase.updateBusAlert(this.selectedAlert!.id, {
      origem:       this.toTitleCase(this.detailForm.origem),
      origem_slug:  this.toSlug(this.detailForm.origem) + '-' + this.detailForm.origem_uf.toLowerCase(),
      destino:      this.toTitleCase(this.detailForm.destino),
      destino_slug: this.toSlug(this.detailForm.destino) + '-' + this.detailForm.destino_uf.toLowerCase(),
      data_ida:     this.detailForm.data_ida,
      data_volta:   this.detailForm.data_volta || null,
      meta:         Number(this.detailForm.meta),
      whatsapp:     '55' + this.detailForm.whatsapp
    });

    if (error) {
      this.formError = this.supabase.isSessionError(error)
        ? 'Sua sessão expirou.'
        : 'Erro ao salvar. Tente novamente.';
    } else {
      this.closeDetail();
      await this.loadAlerts();
    }
    this.saving = false;
  }

  async confirmDeleteDetail() {
    if (!this.selectedAlert) return;
    if (!confirm(`Excluir alerta ${this.selectedAlert.origem} → ${this.selectedAlert.destino}?`)) return;
    await this.supabase.deleteBusAlert(this.selectedAlert.id);
    this.alerts = this.alerts.filter(a => a.id !== this.selectedAlert!.id);
    this.closeDetail();
  }

  // ── Util ───────────────────────────────────────────────────

  onProfileSaved(event: { whatsapp: string; nome: string }) {
    if (event.whatsapp) this.profileWhatsapp = event.whatsapp;
    this.profileNome = event.nome;
  }

  showToast(msg: string) {
    this.toasts.push(msg);
    setTimeout(() => this.toasts.shift(), 4000);
  }

  private stripPrefix(phone: string): string {
    return phone.startsWith('55') ? phone.slice(2) : phone;
  }

  private emptyForm() {
    return { origem: '', origem_uf: '', destino: '', destino_uf: '', data_ida: '', data_volta: '', meta: undefined as number | undefined, whatsapp: '' };
  }

  private emptyDetailForm() {
    return { origem: '', origem_uf: '', destino: '', destino_uf: '', data_ida: '', data_volta: '', meta: 0, whatsapp: '', ativo: true };
  }

}
