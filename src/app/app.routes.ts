import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'voos', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'voos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/voos/voos.component').then(m => m.VoosComponent)
  },
  {
    path: 'dashboard',
    redirectTo: 'voos',
    pathMatch: 'full'
  },
  {
    path: 'onibus',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/onibus/onibus.component').then(m => m.OnibusComponent)
  },
  {
    path: 'share/:id',
    loadComponent: () =>
      import('@features/share/share.component').then(m => m.ShareComponent)
  },
  { path: '**', redirectTo: 'voos' }
];
