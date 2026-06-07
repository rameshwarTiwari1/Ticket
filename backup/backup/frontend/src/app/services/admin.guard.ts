import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Allows only users with the 'admin' role (README §3).
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const user = this.authService.getCurrentUser();
    if (!user) return this.router.createUrlTree(['/login']);
    if ((user.role || '').toLowerCase() !== 'admin') {
      return this.router.createUrlTree(['/dashboard']);
    }
    return true;
  }
}
