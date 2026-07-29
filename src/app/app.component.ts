import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  ngOnInit() {
    const saved = localStorage.getItem('theme') ?? 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }
}
