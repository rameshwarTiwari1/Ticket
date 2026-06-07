import { Routes } from '@angular/router';
import { LoginComponent }        from './components/login/login.component';
import { RegistrationComponent } from './components/registration/register-list.component';
import { ForgotPasswordComponent } from './components/forgotPassword/forgot-password.component';
import { DashboardComponent }    from './components/dashboard/dashboard-list.component';
import { ApproverManagementComponent } from './components/approver/approver-management.component';
import { AuthGuard }             from './services/auth.guard';
import { AdminGuard }            from './services/admin.guard';

export const routes: Routes = [
  // 🔓 Public routes
  { path: 'login',           component: LoginComponent,           pathMatch: 'full' },
  { path: 'register',        component: RegistrationComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },

  // 🔒 Protected route
  {
    path:         'dashboard',
    component:    DashboardComponent,
    canActivate:  [AuthGuard]
  },

  // 🔒 Admin-only: approver registry (README §6)
  {
    path:         'approvers',
    component:    ApproverManagementComponent,
    canActivate:  [AuthGuard, AdminGuard]
  },

  // Default + wildcard
  { path: '',   redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];