import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { User } from '../../models/Models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  email    = '';
  password = '';
  message      = '';
  isLoading    = false;
  loggedInUser: User | null = null;
  username     = '';
  returnUrl    = '/dashboard';

  constructor(
    private authService: AuthService,
    private router:      Router,
    private route:       ActivatedRoute,
    private toast:       ToastService,
    private cdr:         ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user && this.authService.isLoggedIn()) {
      this.loggedInUser = user;
      this.username     = `${user.firstName} ${user.lastName}`;
      this.router.navigate(['/dashboard']);
      return;   // already logged in — stop (don't fall through to auto-login)
    }

    // Read query params once via snapshot (no leaking subscription, no re-fire).
    const params = this.route.snapshot.queryParams;
    this.returnUrl = params['returnUrl'] || '/dashboard';

    if (params['email'] && params['password']) {
      this.email    = params['email'];
      this.password = params['password'];
      // Strip credentials from the URL before they linger in history.
      window.history.replaceState({}, document.title, '/login');
      this.login();
    }
  }

  login(): void {
    this.message = '';

    if (!this.email || !this.password) {
      this.toast.warning('Please enter your email and password.');
      return;
    }

    this.isLoading = true;

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading    = false;
        this.loggedInUser = res.user;
        this.username     = `${res.user.firstName} ${res.user.lastName}`;
        this.router.navigateByUrl(this.returnUrl);   // honor deep-link returnUrl
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.message || 'Login failed. Please check your credentials.';
        this.message = msg;
        this.toast.error(msg);
        // HttpClient uses withFetch() and the app has no zone provider, so the
        // error callback runs outside change detection — repaint manually so the
        // button leaves its "Signing In..." state and the message renders.
        this.cdr.detectChanges();
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.loggedInUser = null;
    this.username     = '';
    this.email        = '';
    this.password     = '';
  }
}