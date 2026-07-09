import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';
import { Alert } from '@core/models/alert.model';

@Component({
  selector: 'app-share',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="share-page">
      <div class="share-card fade-up" *ngIf="!loading && alert">

        <div class="share-brand">
          <span class="brand-icon">✈</span>
          <span class="brand-name">VooAlerta</span>
        </div>

        <div class="share-route">
          <span class="iata">{{ alert.origem }}</span>
          <span class="route-arrow">→</span>
          <span class="iata">{{ alert.destino }}</span>
        </div>

        <div class="share-date">
          {{ alert.data_ida | date:'dd/MM/yyyy' }}
          <ng-container *ngIf="alert.data_volta"> → {{ alert.data_volta | date:'dd/MM/yyyy' }}</ng-container>
          <ng-container *ngIf="!alert.data_volta"> · Só ida</ng-container>
        </div>

        <div class="share-prices">
          <div class="price-block">
            <span class="price-label">Preço atual</span>
            <span class="price-value"
              [class.price-below]="minPrice !== null && minPrice <= alert.meta"
              [class.price-above]="minPrice !== null && minPrice > alert.meta">
              <ng-container *ngIf="minPrice !== null">R$ {{ minPrice | number:'1.0-0' }}</ng-container>
              <ng-container *ngIf="minPrice === null">—</ng-container>
            </span>
          </div>
          <div class="price-divider"></div>
          <div class="price-block">
            <span class="price-label">Meta</span>
            <span class="price-value meta-value">R$ {{ alert.meta | number:'1.0-0' }}</span>
          </div>
        </div>

        <div class="share-badge share-badge-below" *ngIf="minPrice !== null && minPrice <= alert.meta">
          🎉 Abaixo da meta! Corre comprar.
        </div>
        <div class="share-badge share-badge-above" *ngIf="minPrice !== null && minPrice > alert.meta">
          ⏳ Ainda acima da meta — continue monitorando.
        </div>

        <div class="share-tags" *ngIf="alert.so_direto || alert.horario_minimo">
          <span class="tag" *ngIf="alert.so_direto">Só direto</span>
          <span class="tag" *ngIf="alert.horario_minimo">A partir das {{ alert.horario_minimo }}</span>
        </div>

        <a class="btn-primary share-cta" href="/" routerLink="/">
          Criar meu alerta de voo
        </a>

      </div>

      <div class="center-state" *ngIf="loading">
        <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
      </div>

      <div class="share-card fade-up center-state" *ngIf="!loading && !alert">
        <div style="font-size:40px;margin-bottom:16px">✈</div>
        <h2>Alerta não encontrado</h2>
        <p style="color:var(--color-text-muted);margin-top:8px">O link pode ter expirado ou sido removido.</p>
        <a class="btn-primary" style="margin-top:24px;display:inline-block" routerLink="/">Ir para o VooAlerta</a>
      </div>
    </div>
  `,
  styles: [`
    .share-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-bg); padding: 24px;
    }
    .share-card {
      background: var(--color-bg-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 40px 36px;
      max-width: 420px; width: 100%; text-align: center;
    }
    .share-brand {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-bottom: 32px;
    }
    .brand-icon { font-size: 20px; }
    .brand-name { font-family: var(--font-display); font-weight: 800; font-size: 16px; }
    .share-route {
      display: flex; align-items: center; justify-content: center; gap: 14px;
      margin-bottom: 10px;
    }
    .iata { font-family: var(--font-display); font-size: 42px; font-weight: 800; }
    .route-arrow { font-size: 28px; color: var(--color-text-muted); }
    .share-date { font-size: 14px; color: var(--color-text-muted); margin-bottom: 32px; }
    .share-prices {
      display: flex; align-items: center; gap: 0;
      background: var(--color-bg-3); border-radius: var(--radius-md);
      padding: 20px; margin-bottom: 16px;
    }
    .price-block { flex: 1; }
    .price-divider { width: 1px; height: 40px; background: var(--color-border); }
    .price-label { display: block; font-size: 12px; color: var(--color-text-muted); margin-bottom: 6px; }
    .price-value { display: block; font-family: var(--font-display); font-size: 26px; font-weight: 700; }
    .price-below { color: var(--color-green); }
    .price-above { color: var(--color-red); }
    .meta-value { color: var(--color-text); }
    .share-badge {
      border-radius: var(--radius-sm); padding: 10px 16px;
      font-size: 14px; font-weight: 500; margin-bottom: 16px;
    }
    .share-badge-below { background: var(--color-green-dim); color: var(--color-green); }
    .share-badge-above { background: var(--color-bg-3); color: var(--color-text-muted); }
    .share-tags { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
    .tag {
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
      background: var(--color-accent-dim); color: var(--color-accent);
    }
    .share-cta {
      display: block; width: 100%; text-align: center;
      padding: 12px; border-radius: var(--radius-sm);
      text-decoration: none; font-size: 14px; font-weight: 600;
      background: var(--color-accent); color: #fff;
      transition: opacity .15s;
    }
    .share-cta:hover { opacity: .88; }
    .center-state { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  `]
})
export class ShareComponent implements OnInit {
  alert: Alert | null = null;
  minPrice: number | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }

    const { data } = await this.supabase.getAlertById(id);
    this.alert = data as Alert | null;

    if (this.alert) {
      this.minPrice = await this.supabase.getMinPriceForRoute(
        this.alert.origem, this.alert.destino, this.alert.data_ida,
        this.alert.data_volta ?? null,
        { horarioMinimo: this.alert.horario_minimo, soDireto: this.alert.so_direto }
      );
    }

    this.loading = false;
  }
}
