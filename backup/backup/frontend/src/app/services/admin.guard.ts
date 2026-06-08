import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Allows only users with the 'admin' role (README §3).
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  private platformId = inject(PLATFORM_ID);

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    // Defer to the browser during SSR (no localStorage on the server).
    if (!isPlatformBrowser(this.platformId)) return true;

    const user = this.authService.getCurrentUser();
    if (!user) return this.router.createUrlTree(['/login']);
    if ((user.role || '').toLowerCase() !== 'admin') {
      return this.router.createUrlTree(['/dashboard']);
    }
    return true;
  }
}
