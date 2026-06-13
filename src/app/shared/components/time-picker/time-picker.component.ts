import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tp-wrap">
      <select class="tp-select" [(ngModel)]="hour" (ngModelChange)="emit()" [name]="name + '_h'">
        <option *ngFor="let h of hours" [value]="h">{{ h }}</option>
      </select>
      <span class="tp-sep">:</span>
      <select class="tp-select" [(ngModel)]="minute" (ngModelChange)="emit()" [name]="name + '_m'">
        <option *ngFor="let m of minutes" [value]="m">{{ m }}</option>
      </select>
    </div>
  `,
  styles: [`
    .tp-wrap { display: flex; align-items: center; gap: 6px; }
    .tp-select {
      flex: 1; padding: 9px 8px; border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); background: var(--color-bg-2);
      color: var(--color-text); font-size: 14px; cursor: pointer;
      transition: border-color var(--transition);
    }
    .tp-select:focus { outline: none; border-color: var(--color-accent); }
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
