import { Component, Input, Output, EventEmitter, HostListener, ElementRef, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dp-wrap">
      <button type="button" class="dp-input" (click)="toggle()" [class.dp-disabled]="disabled">
        <span [class.dp-placeholder]="!value">{{ displayValue || placeholder }}</span>
        <span class="dp-icon">📅</span>
      </button>

      <div class="dp-popup" *ngIf="open">
        <div class="dp-header">
          <button type="button" class="dp-nav" (click)="prevMonth()">‹</button>
          <span class="dp-month-label">{{ monthLabel }}</span>
          <button type="button" class="dp-nav" (click)="nextMonth()">›</button>
        </div>

        <div class="dp-grid dp-weekdays">
          <span *ngFor="let d of weekDays">{{ d }}</span>
        </div>

        <div class="dp-grid dp-days">
          <span *ngFor="let slot of calendarSlots"
            [class.dp-empty]="slot === null"
            [class.dp-day]="slot !== null"
            [class.dp-selected]="slot !== null && isSelected(slot)"
            [class.dp-today]="slot !== null && isToday(slot)"
            [class.dp-past]="slot !== null && isDisabled(slot)"
            (click)="slot !== null && !isDisabled(slot) && select(slot)">
            {{ slot !== null ? slot : '' }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dp-wrap { position: relative; }
    .dp-input {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: 9px 12px; border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); background: var(--color-bg-2);
      color: var(--color-text); font-size: 14px; cursor: pointer;
      transition: border-color var(--transition); text-align: left;
    }
    .dp-input:hover:not(.dp-disabled) { border-color: var(--color-border-hover); }
    .dp-disabled { opacity: .45; cursor: not-allowed; pointer-events: none; }
    .dp-placeholder { color: var(--color-text-muted); }
    .dp-icon { font-size: 13px; opacity: .5; }
    .dp-popup {
      position: absolute; top: calc(100% + 6px); left: 0; z-index: 300;
      background: var(--color-bg-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 14px; min-width: 260px;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }
    .dp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .dp-nav {
      width: 28px; height: 28px; border: none; background: transparent;
      color: var(--color-text); font-size: 20px; cursor: pointer; border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      transition: background var(--transition);
    }
    .dp-nav:hover { background: var(--color-bg-3); }
    .dp-month-label { font-weight: 600; font-size: 14px; }
    .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .dp-weekdays { margin-bottom: 4px; }
    .dp-weekdays span { text-align: center; font-size: 11px; color: var(--color-text-muted); padding: 4px 0; }
    .dp-day {
      text-align: center; padding: 6px 2px; font-size: 13px;
      border-radius: var(--radius-sm); cursor: pointer;
      transition: background var(--transition);
    }
    .dp-day:hover:not(.dp-past):not(.dp-selected) { background: var(--color-bg-3); }
    .dp-selected { background: var(--color-accent) !important; color: #fff; font-weight: 600; }
    .dp-today:not(.dp-selected) { color: var(--color-accent); font-weight: 600; }
    .dp-past { color: var(--color-text-muted); opacity: .4; cursor: not-allowed; }
    .dp-empty { pointer-events: none; }
  `]
})
export class DatePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() min   = '';
  @Input() placeholder = 'Selecionar data';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  viewYear  = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  readonly weekDays = DAYS;
  private today = new Date();

  constructor(private el: ElementRef) {}

  ngOnChanges() {
    if (this.value) {
      const [y, m] = this.value.split('-').map(Number);
      if (y && m) { this.viewYear = y; this.viewMonth = m - 1; }
    }
  }

  get displayValue(): string {
    if (!this.value) return '';
    const [y, m, d] = this.value.split('-');
    return `${d}/${m}/${y}`;
  }

  get monthLabel(): string {
    return `${MONTHS[this.viewMonth]} ${this.viewYear}`;
  }

  get calendarSlots(): (number | null)[] {
    const firstDay    = new Date(this.viewYear, this.viewMonth, 1).getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const slots: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) slots.push(d);
    return slots;
  }

  isSelected(day: number): boolean {
    return this.value === this.isoDate(day);
  }

  isToday(day: number): boolean {
    return this.viewYear  === this.today.getFullYear() &&
           this.viewMonth === this.today.getMonth() &&
           day            === this.today.getDate();
  }

  isDisabled(day: number): boolean {
    return !!this.min && this.isoDate(day) < this.min;
  }

  select(day: number) {
    this.value = this.isoDate(day);
    this.valueChange.emit(this.value);
    this.open = false;
  }

  prevMonth() {
    if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
    else this.viewMonth--;
  }

  nextMonth() {
    if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
    else this.viewMonth++;
  }

  toggle() { if (!this.disabled) this.open = !this.open; }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) this.open = false;
  }

  private isoDate(day: number): string {
    const m = String(this.viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${this.viewYear}-${m}-${d}`;
  }
}
