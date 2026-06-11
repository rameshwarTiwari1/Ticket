// src/app/components/register/register-list.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RegistrationService } from '../../services/registration.service';
import { TeamService } from '../../services/team.service';
import { OrganizationService } from '../../services/organization.service';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { Team, Location, Wing, Organization } from '../../models/Models';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register-list.component.html',
  styleUrls: ['./register-list.component.css'],
})
export class RegistrationComponent implements OnInit {

  form: FormGroup;
  otpSent     = false;
  otpVerified = false;
  isSendingOtp   = false;
  isVerifyingOtp = false;
  isSubmitting   = false;

  teams:         Team[]         = [];
  locations:     Location[]     = [];
  wings:         Wing[]         = [];
  filteredWings: Wing[]         = [];
  organizations: Organization[] = [];

  // Loading + error state for dropdowns
  teamsLoading   = true;
  teamsError     = false;
  orgsLoading    = true;
  orgsError      = false;

  constructor(
    private fb:          FormBuilder,
    private service:     RegistrationService,
    private teamService: TeamService,
    private orgService:  OrganizationService,
    private router:      Router,
    private toast:       ToastService,
  ) {
    this.form = this.fb.group({
      firstName:    ['', Validators.required],
      lastName:     ['', Validators.required],
      // mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      teamId:       ['', Validators.required],
      orgName:      ['', Validators.required],
      email:        ['', [Validators.required, Validators.email]],
      otp:          [''],
      password:     [{ value: '', disabled: true }, Validators.required],
      employeeId:   ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadTeams();
    this.loadOrganizations();

    // If the email is changed after an OTP was sent/verified, invalidate it —
    // the OTP belongs to the previous address.
    this.form.get('email')?.valueChanges.subscribe(() => {
      if (this.otpSent || this.otpVerified) {
        this.otpSent = false;
        this.otpVerified = false;
        this.form.get('otp')?.reset();
        this.form.get('password')?.disable();
      }
    });
  }

  loadTeams(): void {
    this.teamsLoading = true;
    this.teamsError   = false;

    this.teamService.getAllTeamsPublic().subscribe({
      next: (res: Team[]) => {
        this.teams        = res || [];
        this.teamsLoading = false;
      },
      error: (err) => {
        this.teamsError   = true;
        this.teamsLoading = false;
      },
    });
  }

  loadOrganizations(): void {
    this.orgsLoading = true;
    this.orgsError   = false;

    this.orgService.getAllPublic().subscribe({
      next: (res: Organization[]) => {
        this.organizations = res || [];
        this.orgsLoading   = false;
      },
      error: (err) => {
        this.orgsError   = true;
        this.orgsLoading = false;
      },
    });
  }

  sendOtp(): void {
    const emailControl = this.form.get('email');
    if (!emailControl?.valid) { this.toast.warning('Enter a valid email first'); return; }
    if (this.isSendingOtp) return;   // prevent double-send

    this.isSendingOtp = true;
    this.service.sendOtp(emailControl.value).subscribe({
      next: () => { this.otpSent = true; this.isSendingOtp = false; this.toast.success('OTP sent to your email'); },
      error: () => { this.isSendingOtp = false; this.toast.error('Failed to send OTP. Please try again.'); },
    });
  }

  verifyOtp(): void {
    const email = this.form.value.email;
    const otp   = this.form.value.otp;
    if (!otp) { this.toast.warning('Enter OTP first'); return; }
    if (this.isVerifyingOtp) return;

    this.isVerifyingOtp = true;
    this.service.verifyOtp(email, otp).subscribe({
      next: () => {
        this.otpVerified = true;
        this.form.get('password')?.enable();
        this.isVerifyingOtp = false;
        this.toast.success('OTP Verified successfully');
      },
      error: () => { this.isVerifyingOtp = false; this.toast.error('Invalid or expired OTP'); },
    });
  }

submit(): void {
  if (!this.otpVerified) { this.toast.warning('Please verify OTP first'); return; }
  if (this.form.invalid)  { this.form.markAllAsTouched(); this.toast.warning('Please fill all required fields'); return; }
  if (this.isSubmitting) return;   // prevent double-submit
  this.isSubmitting = true;

  const raw = this.form.getRawValue();
  const selectedTeam = this.teams.find(t => String(t.team_id) === String(raw.teamId));

  // ✅ Exact field names the backend controller expects
  const payload = {
    employee_id:   raw.employeeId,          // snake_case ✅
    first_name:    raw.firstName,
    last_name:     raw.lastName,
    // mobile_number: raw.mobileNumber,
    email_id:      raw.email,
    password:      raw.password,
    team_name:     selectedTeam?.team_name || '',  // name not ID ✅
    org_name:      raw.orgName || null,
    otp:           raw.otp,                 // ✅ needed for OTP check
  };

  this.service.registerUser(payload).subscribe({
    next: () => {
      this.isSubmitting = false;
      this.toast.success('Registered successfully! Please login.');
      setTimeout(() => this.router.navigateByUrl('/login'), 800);
    },
    error: (err) => {
      this.isSubmitting = false;
      this.toast.error(err.error?.message || 'Registration failed. Please try again.');
    },
  });
}
}