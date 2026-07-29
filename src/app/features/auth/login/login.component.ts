import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule, RouterLink],
    styleUrls: ['../auth.styles.css'],
    template: `
    <div class="auth-page">
      <div class="auth-box fade-up">
    
        <div class="auth-brand">
          <div class="auth-brand-icon">✈</div>
          <span class="auth-brand-name">Viagem Alerta</span>
        </div>
    
        <h1 class="auth-title">Boas-vindas de volta</h1>
        <p class="auth-subtitle">Acompanhe suas rotas e receba alertas no WhatsApp.</p>
    
        <form (ngSubmit)="onSubmit()">
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
              <label for="password">Senha</label>
              <div class="password-wrap">
                <input
                  id="password"
                  [type]="showPwd ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                  />
                  <button type="button" class="eye-btn" (click)="showPwd = !showPwd"
                    [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'">
                    {{ showPwd ? '○' : '●' }}
                  </button>
                </div>
              </div>
    
              @if (error) {
                <div class="error-box" style="margin-top: 14px">{{ error }}</div>
              }
    
              <button type="submit" class="btn-primary auth-submit" [disabled]="loading">
                @if (loading) {
                  <span class="spinner"></span>
                }
                @if (!loading) {
                  <span>Entrar</span>
                }
              </button>
            </form>
    
            <p class="auth-footer">
              Não tem conta? <a routerLink="/register">Criar conta</a>
            </p>
          </div>
        </div>
    `
})
export class LoginComponent {
  email    = '';
  password = '';
  showPwd  = false;
  loading  = false;
  error    = '';

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async onSubmit() {
    this.loading = true;
    this.error   = '';
    const { error } = await this.supabase.signIn(this.email, this.password);
    if (error) {
      this.error = 'E-mail ou senha incorretos.';
    } else {
      this.router.navigate(['/dashboard']);
    }
    this.loading = false;
  }
}
