import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
    selector: 'app-sidebar',
    imports: [FormsModule],
    styleUrls: ['./sidebar.component.css'],
    template: `
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="brand">
          <div class="brand-icon">✈</div>
          <span class="brand-name">Viagem Alerta</span>
        </div>
        <nav class="sidebar-nav">
          <button class="nav-item" [class.active]="active === 'voos'" (click)="router.navigate(['/voos'])">
            <span class="nav-icon">◫</span> Voos
          </button>
          <button class="nav-item" [class.active]="active === 'onibus'" (click)="router.navigate(['/onibus'])">
            <span class="nav-icon">⊟</span> Ônibus
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
    
    <!-- ── Modal perfil ── -->
    @if (showProfileModal) {
      <div class="modal-overlay" (click)="onOverlayClick($event)">
        <div class="modal fade-up" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
          <div class="modal-head">
            <h2 id="profile-modal-title">Meu perfil</h2>
            <button class="btn-icon" (click)="closeProfileModal()" aria-label="Fechar">✕</button>
          </div>
          @if (profileLoading) {
            <div class="center-state" style="padding:32px">
              <div class="spinner spinner-dark" style="width:24px;height:24px;border-width:3px"></div>
            </div>
          }
          @if (!profileLoading) {
            <form (ngSubmit)="saveProfile()">
              <div class="form-group">
                <label>E-mail</label>
                <input type="email" [value]="userEmail" disabled style="opacity:.45;cursor:not-allowed" />
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
                    @if (!profileForm.callmebot_key) {
                      <span class="form-hint">
                        Não tem? Envie <strong>I allow callmebot to send me messages</strong> para
                        <strong>+34 644 81 58 78</strong> no WhatsApp — a key chega em segundos.
                      </span>
                    }
                  </div>
                  @if (profileError) {
                    <div class="error-box" style="margin-top:14px">{{ profileError }}</div>
                  }
                  @if (profileSuccess) {
                    <div class="success-box" style="margin-top:14px">Perfil salvo com sucesso!</div>
                  }
                  <div class="modal-actions" style="justify-content:space-between">
                    @if (!profileForm.callmebot_key) {
                      <a class="btn-whatsapp"
                        href="https://wa.me/34644815878?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                        target="_blank" rel="noopener">
                        📲 Ativar CallMeBot
                      </a>
                    }
                    @if (profileForm.callmebot_key) {
                      <span></span>
                    }
                    <div style="display:flex;gap:8px">
                      <button type="button" class="btn-ghost" (click)="closeProfileModal()">Cancelar</button>
                      <button type="submit" class="btn-primary modal-save" [disabled]="profileSaving">
                        @if (profileSaving) {
                          <span class="spinner"></span>
                        }
                        @if (!profileSaving) {
                          <span>Salvar</span>
                        }
                      </button>
                    </div>
                  </div>
                </form>
              }
            </div>
          </div>
        }
    `
})
export class SidebarComponent implements OnInit {
  @Input() active: 'voos' | 'onibus' = 'voos';
  @Input() userEmail = '';
  @Input() isDark = true;
  @Output() themeChange = new EventEmitter<boolean>();
  @Output() profileSaved = new EventEmitter<{ whatsapp: string }>();

  showProfileModal = false;
  profileLoading   = false;
  profileSaving    = false;
  profileError     = '';
  profileSuccess   = false;
  profileForm      = { whatsapp: '', callmebot_key: '' };

  constructor(public router: Router, private supabase: SupabaseService) {}

  ngOnInit() {}

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.themeChange.emit(this.isDark);
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

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeProfileModal();
  }

  async saveProfile() {
    this.profileSaving  = true;
    this.profileError   = '';
    this.profileSuccess = false;

    if (this.profileForm.whatsapp && this.profileForm.whatsapp.replace(/\D/g, '').length !== 11) {
      this.profileError  = 'WhatsApp inválido. Digite DDD + número (11 dígitos).';
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
      this.profileSuccess = true;
      this.profileSaved.emit({ whatsapp: this.profileForm.whatsapp });
    }
    this.profileSaving = false;
  }

  private stripPrefix(phone: string): string {
    return phone.startsWith('55') ? phone.slice(2) : phone;
  }
}
