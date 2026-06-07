import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistrationService } from '../../services/registration.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {

  step = 1;
  email = '';
  otp = '';
  newPassword = '';
  confirmPassword = '';
  message = '';
  error = '';


  constructor(private service: RegistrationService, private router: Router) {}
// isLoading = false;

// sendOtp(): void {
//   if (this.isLoading) return; // ✅ prevent double click

//   this.clearMessages();

//   if (!this.email) {
//     this.error = 'Email is required';
//     return;
//   }

//   this.isLoading = true; // ✅ start loading

//   this.service.sendOtp(this.email).subscribe({
//     next: () => {
//       this.message = 'OTP sent successfully';
//       this.step = 2;
//       this.isLoading = false; // ✅ stop loading
//     },
//     error: () => {
//       this.error = 'Failed to send OTP';
//       this.isLoading = false; // ✅ stop loading
//     }
//   });
// }

// verifyOtp(): void {
//   if (this.isLoading) return;

//   this.clearMessages();

//   if (this.otp.length !== 6) {
//     this.error = 'Invalid OTP';
//     return;
//   }

//   this.isLoading = true;

//   this.service.verifyOtp(this.email, this.otp).subscribe({
//     next: () => {
//       this.message = 'OTP verified';
//       this.step = 3;
//       this.isLoading = false;
//     },
//     error: () => {
//       this.error = 'Invalid OTP';
//       this.isLoading = false;
//     }
//   });
// }

// resetPassword(): void {
//   if (this.isLoading) return;

//   this.clearMessages();

//   if (!this.newPassword || !this.confirmPassword) {
//     this.error = 'All fields required';
//     return;
//   }

//   if (this.newPassword !== this.confirmPassword) {
//     this.error = 'Passwords do not match';
//     return;
//   }

//   this.isLoading = true;

//   this.service.resetPassword(this.email, this.otp, this.newPassword).subscribe({
//     next: () => {
//       this.message = 'Password reset successfully';
//       this.isLoading = false;

//       setTimeout(() => {
//         this.router.navigate(['/login']);
//       }, 2000);
//     },
//     error: () => {
//       this.error = 'Failed to reset password';
//       this.isLoading = false;
//     }
//   });
// }

//   private clearMessages() { this.message = ''; this.error = ''; }
// }

isLoading = false;

sendOtp(): void {
  if (this.isLoading) return;

  this.clearMessages();

  if (!this.email) {
    this.error = 'Email is required';
    return;
  }

  this.isLoading = true;

  this.service.sendOtp(this.email).subscribe({
    next: (res) => {
      this.message = res.message || 'OTP sent successfully';

      // ✅ immediately move to OTP step
      this.step = 2;

      this.isLoading = false;
    },
    error: (err) => {
      this.error = err?.error?.message || 'Failed to send OTP';
      this.isLoading = false;
    }
  });
}

verifyOtp(): void {
  if (this.isLoading) return;

  this.clearMessages();

  if (!this.otp || this.otp.length !== 6) {
    this.error = 'Enter valid 6-digit OTP';
    return;
  }

  this.isLoading = true;

  this.service.verifyOtp(this.email, this.otp).subscribe({
    next: (res) => {
      this.message = res.message || 'OTP verified successfully';

      // ✅ immediately move to password step
      this.step = 3;

      this.isLoading = false;
    },
    error: (err) => {
      this.error = err?.error?.message || 'Invalid OTP';
      this.isLoading = false;
    }
  });
}

resetPassword(): void {
  if (this.isLoading) return;

  this.clearMessages();

  if (!this.newPassword || !this.confirmPassword) {
    this.error = 'All fields are required';
    return;
  }

  if (this.newPassword !== this.confirmPassword) {
    this.error = 'Passwords do not match';
    return;
  }

  this.isLoading = true;

  this.service.resetPassword(this.email, this.otp, this.newPassword).subscribe({
    next: (res) => {
      this.message = res.message || 'Password reset successfully';
      this.isLoading = false;

      // ✅ redirect after success
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1500);
    },
    error: (err) => {
      this.error = err?.error?.message || 'Failed to reset password';
      this.isLoading = false;
    }
  });
}

private clearMessages(): void {
  this.message = '';
  this.error = '';
}
}