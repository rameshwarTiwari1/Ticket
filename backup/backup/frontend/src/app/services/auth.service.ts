import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { User } from '../models/Models';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { NgZone } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly USER_KEY  = 'user';   // ✅ single source of truth
  private readonly TOKEN_KEY = 'token';

  private apiUrl    = `${environment.apiUrl}`;
  private platformId = inject(PLATFORM_ID);

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUser());
  public  currentUser$       = this.currentUserSubject.asObservable();
  private ngZone= inject(NgZone); //tracking the UI activity screen


  constructor(private router: Router, private http: HttpClient) {}


  //this is time activity  slot

   private readonly INACTIVITY_LIMIT = 5 * 60 * 1000;  //Time
   private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
   private boundReset = this.resetTimer.bind(this);
   private readonly ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'keydown',
    'scroll', 'touchstart', 'click'
  ];

  //add below methods to help the track activity
  startActivityWatcher(): void {
  if (!this.isBrowser()) return;
  this.stopActivityWatcher();   // ensure we never stack duplicate listeners/timers
  this.ACTIVITY_EVENTS.forEach(event =>
    window.addEventListener(event, this.boundReset, { passive: true })
  );
  this.resetTimer();
}

private resetTimer(): void {
  if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  this.inactivityTimer = setTimeout(() => {
    this.logout();
    this.router.navigate(['/login']);
  }, this.INACTIVITY_LIMIT);
}

private stopActivityWatcher(): void {
  if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  this.inactivityTimer = null;
  if (this.isBrowser()) {
    this.ACTIVITY_EVENTS.forEach(event =>
      window.removeEventListener(event, this.boundReset)
    );
  }
}


  /* ── browser guard ─────────────────────────────────────────── */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /* ── read user from storage on startup ─────────────────────── */
  private loadUser(): User | null {
    if (!this.isBrowser()) return null;
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /* ── LOGIN ──────────────────────────────────────────────────── */
  login(email: string, password: string): Observable<{ token: string; user: User }> {
    return this.http
      .post<{ token: string; user: User }>(`${this.apiUrl}/users/login`, { email, password })
      .pipe(
        tap(res => {
          if (this.isBrowser()) {
            localStorage.setItem(this.TOKEN_KEY, res.token);
            localStorage.setItem(this.USER_KEY,  JSON.stringify(res.user)); // ✅ always 'user'
          }
          this.currentUserSubject.next(res.user);
           this.startActivityWatcher();
        }),
        catchError(err => {
          const message = err.error?.message || 'Login failed. Please check your credentials.';
          return throwError(() => ({ message }));
        })
      );
  }

  /* ── GET CURRENT USER ───────────────────────────────────────── */
  getCurrentUser(): User | null {
    // ✅ always reads from the same key used by login()
    if (this.currentUserSubject.value) return this.currentUserSubject.value;
    return this.loadUser();
  }

  /* ── GET TOKEN ──────────────────────────────────────────────── */
  getToken(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /* ── GET CURRENT USER ID ────────────────────────────────────── */
  getCurrentUserId(): number | null {
    return this.getCurrentUser()?.id ?? null;
  }

  /* ── IS LOGGED IN ───────────────────────────────────────────── */
  isLoggedIn(): boolean {
    return !!(this.getCurrentUser() && this.getToken());
  }

  /* ── LOGOUT ─────────────────────────────────────────────────── */
  logout(): void {
     this.stopActivityWatcher(); 
    if (this.isBrowser()) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUserSubject.next(null);
  }

  /* ── LOGOUT AND REDIRECT ────────────────────────────────────── */
  logoutAndRedirect(): void {
    this.logout();
    this.router.navigate(['/login']);
  }
}