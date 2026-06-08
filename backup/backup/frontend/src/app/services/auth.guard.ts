import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  private platformId = inject(PLATFORM_ID);

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    // On the server there is no localStorage, so isLoggedIn() is always false.
    // Defer the decision to the browser to avoid a server-side redirect flash.
    if (!isPlatformBrowser(this.platformId)) return true;

    return this.authService.isLoggedIn()
      ? true
      : this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
  }
}