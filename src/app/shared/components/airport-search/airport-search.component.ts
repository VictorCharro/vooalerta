import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Airport, searchAirports } from '@shared/data/airports';

@Component({
    selector: 'app-airport-search',
    imports: [FormsModule],
    template: `
    <div class="airport-search">
      <input
        [id]="inputId"
        type="text"
        [(ngModel)]="query"
        [name]="inputId"
        [placeholder]="placeholder"
        (input)="onInput()"
        (focus)="onInput()"
        (keydown.escape)="close()"
        (keydown.arrowdown)="moveDown($event)"
        (keydown.arrowup)="moveUp($event)"
        (keydown.enter)="selectActive($event)"
        autocomplete="off"
        />
        @if (results.length > 0) {
          <ul class="airport-dropdown">
            @for (a of results; track a; let i = $index) {
              <li
                [class.active]="i === activeIndex"
                (mousedown)="select(a)">
                <span class="airport-iata">{{ a.iata }}</span>
                <span class="airport-info">{{ a.city }} · {{ a.name }}</span>
                <span class="airport-country">{{ a.country }}</span>
              </li>
            }
          </ul>
        }
      </div>
    `,
    styles: [`
    .airport-search { position: relative; }
    .airport-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200;
      background: var(--color-bg-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); list-style: none; margin: 0; padding: 4px 0;
      box-shadow: 0 8px 24px rgba(0,0,0,.2); max-height: 240px; overflow-y: auto;
    }
    li {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; cursor: pointer; font-size: 13px;
      transition: background .1s;
    }
    li:hover, li.active { background: var(--color-bg-3); }
    .airport-iata {
      font-family: var(--font-display); font-weight: 700; font-size: 14px;
      color: var(--color-accent); min-width: 36px;
    }
    .airport-info { flex: 1; color: var(--color-text); }
    .airport-country { font-size: 11px; color: var(--color-text-muted); }
  `]
})
export class AirportSearchComponent {
  @Input() inputId = 'airport-search';
  @Input() placeholder = 'GRU';
  @Input()
  set value(v: string) {
    if (v !== this._lastSelected) this.query = v;
  }
  @Output() selected = new EventEmitter<string>();

  query = '';
  results: Airport[] = [];
  activeIndex = -1;
  private _lastSelected = '';

  constructor(private el: ElementRef) {}

  onInput() {
    this.results = searchAirports(this.query);
    this.activeIndex = -1;
  }

  select(a: Airport) {
    this._lastSelected = a.iata;
    this.query = `${a.iata} — ${a.city}`;
    this.results = [];
    this.selected.emit(a.iata);
  }

  close() { this.results = []; }

  moveDown(e: Event) {
    e.preventDefault();
    this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
  }

  moveUp(e: Event) {
    e.preventDefault();
    this.activeIndex = Math.max(this.activeIndex - 1, 0);
  }

  selectActive(e: Event) {
    if (this.activeIndex >= 0 && this.results[this.activeIndex]) {
      e.preventDefault();
      this.select(this.results[this.activeIndex]);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) this.close();
  }
}
