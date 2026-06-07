// src/app/components/register/register-list.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RegistrationService } from '../../services/registration.service';
import { TeamService } from '../../services/team.service';
import { OrganizationService } from '../../services/organization.service';
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
    if (!emailControl?.valid) { alert('Enter a valid email first'); return; }
    if (this.otpSent && !this.otpVerified) { alert('OTP already sent. Check your email.'); return; }

    this.otpSent = true;

    this.service.sendOtp(emailControl.value).subscribe({
      next: () => { alert('OTP sent to your email'); },
      error: () => {
        this.otpSent = false;
        alert('Failed to send OTP. Please try again.');
      },
    });
  }

  verifyOtp(): void {
    const email = this.form.value.email;
    const otp   = this.form.value.otp;
    if (!otp) { alert('Enter OTP first'); return; }

    this.service.verifyOtp(email, otp).subscribe({
      next: () => {
        this.otpVerified = true;
        this.form.get('password')?.enable();
        alert('OTP Verified successfully');
      },
      error: () => { alert('Invalid or expired OTP'); },
    });
  }

submit(): void {
  if (!this.otpVerified) { alert('Please verify OTP first'); return; }
  if (this.form.invalid)  { this.form.markAllAsTouched(); alert('Please fill all required fields'); return; }

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
      alert('Registered successfully! Please login.');
      setTimeout(() => this.router.navigateByUrl('/login'), 500);
    },
    error: (err) => {
      alert(err.error?.message || 'Registration failed. Please try again.');
    },
  });
}
}