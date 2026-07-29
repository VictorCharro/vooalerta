import { ApplicationConfig } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { VooAlertaPreset } from './core/theme/vooalerta-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
    providePrimeNG({
      theme: {
        preset: VooAlertaPreset,
        options: {
          darkModeSelector: false
        }
      }
    })
  ]
};
