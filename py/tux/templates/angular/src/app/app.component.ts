import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly tabs = ['all', 'featured'];
  readonly products = [
    { id: 'p1', name: 'Trail Shoes', price: '119 €' },
    { id: 'p2', name: 'Rain Jacket', price: '89 €' },
  ];

  route = window.location.pathname;
  tab = 'all';
  modalOpen = false;

  constructor() {
    window.onpopstate = () => {
      this.route = window.location.pathname;
    };
  }

  navigate(href: string, event: Event): void {
    event.preventDefault();
    window.history.pushState(null, '', href);
    this.route = href;
  }
}
