import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrls: ['../auth.styles.css'],
  template: `
    <div class="auth-page">
      <div class="auth-box fade-up">

        <div class="auth-brand">
          <div class="auth-brand-icon">✈</div>
          <span class="auth-brand-name">VooAlerta</span>
        </div>

        <h1 class="auth-title">Criar conta</h1>
        <p class="auth-subtitle">Defina suas rotas e meta de preço — a gente avisa no WhatsApp.</p>

        <form (ngSubmit)="onSubmit()" *ngIf="!success">
          <div class="form-group">
            <label for="email">E-mail</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="voce@email.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="form-group" style="margin-top: 14px">
            <label for="whatsapp">WhatsApp</label>
            <div class="phone-input">
              <span class="phone-prefix">55</span>
              <input
                id="whatsapp"
                type="tel"
                [(ngModel)]="whatsapp"
                name="whatsapp"
                placeholder="11999999999"
                maxlength="11"
                required
              />
            </div>
            <span class="form-hint">DDD + número (ex: 11999999999)</span>
          </div>

          <div class="form-group" style="margin-top: 14px">
            <label for="password">Senha</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="mínimo 6 caracteres"
              autocomplete="new-password"
              minlength="6"
              required
            />
          </div>

          <div *ngIf="error" class="error-box" style="margin-top: 14px">{{ error }}</div>

          <button type="submit" class="btn-primary auth-submit" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            <span *ngIf="!loading">Criar conta</span>
          </button>
        </form>

        <div *ngIf="success" class="success-confirm">
          <div class="confirm-icon">✓</div>
          <h3>Confirme seu e-mail</h3>
          <p>Enviamos um link para <strong>{{ email }}</strong>.<br>Clique no link e depois faça login.</p>
        </div>

        <p class="auth-footer" *ngIf="!success">
          Já tem conta? <a routerLink="/login">Entrar</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .success-confirm { text-align: center; padding: 8px 0 4px; }
    .confirm-icon {
      width: 52px; height: 52px;
      background: var(--color-green-dim);
      color: var(--color-green);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; margin: 0 auto 16px;
    }
    .success-confirm h3 { font-size: 18px; margin-bottom: 8px; }
    .success-confirm p { color: var(--color-text-muted); font-size: 13px; line-height: 1.7; }
    .success-confirm strong { color: var(--color-text); }
  `]
})
export class RegisterComponent {
  email    = '';
  password = '';
  whatsapp = '';
  loading  = false;
  error    = '';
  success  = false;

  constructor(private supabase: SupabaseService) {}

  async onSubmit() {
    this.loading = true;
    this.error   = '';

    if (this.whatsapp.replace(/\D/g, '').length !== 11) {
      this.error   = 'WhatsApp inválido. Digite DDD + número (11 dígitos, ex: 11999999999).';
      this.loading = false;
      return;
    }

    const { error } = await this.supabase.signUp(this.email, this.password, '55' + this.whatsapp);
    if (error) {
      this.error = error.message;
    } else {
      this.success = true;
    }
    this.loading = false;
  }
}
