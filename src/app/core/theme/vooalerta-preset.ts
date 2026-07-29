import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Paleta baseada no Figma do VooAlerta (redesign PrimeNG).
// Aplicada via `options.darkModeSelector: false` no providePrimeNG,
// entao so a chave `light` do colorScheme e usada (o app so tem um tema escuro por enquanto).
export const VooAlertaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fbe4ec',
      100: '#f3b9cd',
      200: '#ea8dac',
      300: '#e0618b',
      400: '#d63f72',
      500: '#C6194D',
      600: '#a8163f',
      700: '#8a1234',
      800: '#6F132F',
      900: '#520d21',
      950: '#350815'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#E8E8E8',
          50: '#E8E8E8',
          100: '#8B8B8B',
          200: '#8B8B8B',
          300: '#232021',
          400: '#242323',
          500: '#242323',
          600: '#161616',
          700: '#161616',
          800: '#111010',
          900: '#111010',
          950: '#000000'
        },
        primary: {
          color: '#C6194D',
          contrastColor: '#E8E8E8',
          hoverColor: '#6F132F',
          activeColor: '#6F132F'
        },
        text: {
          color: '#E8E8E8',
          hoverColor: '#E8E8E8',
          mutedColor: '#8B8B8B',
          hoverMutedColor: '#E8E8E8'
        },
        content: {
          background: '#242323',
          hoverBackground: '#232021',
          borderColor: '#232021',
          color: '#E8E8E8',
          hoverColor: '#E8E8E8'
        },
        formField: {
          background: '#242323',
          disabledBackground: '#232021',
          filledBackground: '#242323',
          borderColor: '#232021',
          hoverBorderColor: '#8B8B8B',
          focusBorderColor: '#C6194D',
          color: '#E8E8E8',
          disabledColor: '#8B8B8B',
          placeholderColor: '#8B8B8B'
        },
        overlay: {
          select: { background: '#242323', borderColor: '#232021', color: '#E8E8E8' },
          popover: { background: '#242323', borderColor: '#232021', color: '#E8E8E8' },
          modal: { background: '#161616', borderColor: '#232021', color: '#E8E8E8' }
        }
      }
    }
  }
});

// Cores auxiliares de status usadas fora do sistema de tokens do PrimeNG
// (mantidas tambem em src/styles/theme.css como variaveis CSS).
export const VOOALERTA_COLORS = {
  danger: '#BB070A',
  success: '#09AE00',
  warning: '#D17300'
};
