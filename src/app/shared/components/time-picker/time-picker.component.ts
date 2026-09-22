import { Component, Input, Output, EventEmitter } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';

@Component({
    selector: 'app-time-picker',
    imports: [FormsModule, Select],
    template: `
    <div class="tp-wrap">
      <p-select class="tp-select" [options]="hours" [(ngModel)]="hour" (ngModelChange)="emit()" [name]="name + '_h'" />
      <span class="tp-sep">:</span>
      <p-select class="tp-select" [options]="minutes" [(ngModel)]="minute" (ngModelChange)="emit()" [name]="name + '_m'" />
    </div>
    `,
    styles: [`
    .tp-wrap { display: flex; align-items: center; gap: 6px; }
    .tp-select { flex: 1; }
    .tp-sep { font-weight: 700; color: var(--color-text-muted); }
  `]
})
export class TimePickerComponent {
  @Input() name = 'time';
  @Input()
  set value(v: string) {
    if (v && v !== '00:00') {
      const [h, m] = v.split(':');
      this.hour   = h?.padStart(2, '0') ?? '00';
      this.minute = m?.padStart(2, '0') ?? '00';
    } else {
      this.hour = '00'; this.minute = '00';
    }
  }
  @Output() valueChange = new EventEmitter<string>();

  hour   = '00';
  minute = '00';

  readonly hours   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  emit() { this.valueChange.emit(`${this.hour}:${this.minute}`); }
}
