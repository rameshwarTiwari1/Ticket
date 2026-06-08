import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken(); // ✅ uses service, not raw localStorage

    const authRequest = token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(authRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Only force a logout/redirect for an EXPIRED session on a protected call —
        // not for 401s from the public auth endpoints (login / OTP / reset), whose
        // own components handle the error (wrong password, bad OTP, etc.).
        if (error.status === 401 && token && !this.isAuthEndpoint(authRequest.url)) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        if (error.status === 403) {
          console.warn('403 Forbidden – insufficient permissions');
        }
        return throwError(() => error);
      })
    );
  }

  private isAuthEndpoint(url: string): boolean {
    return /\/users\/login|\/auth\/|\/otp\//.test(url);
  }
}