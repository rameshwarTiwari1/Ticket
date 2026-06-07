import { Component } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent {
  showLayout = true;
  private readonly hiddenRoutes = [
    '/login',
    '/register',
    '/forgot-password'
  ];

constructor(private router: Router, private authService: AuthService) {
  this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => {
      const currentUrl = this.router.url.split('?')[0];
      this.showLayout = !this.hiddenRoutes.includes(currentUrl);
    });
}}