import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApproverService } from '../../services/approver.service';
import { LocationService } from '../../services/location.service';
import { TeamService } from '../../services/team.service';
import { OrganizationService } from '../../services/organization.service';
import { Approver, Location, Team, Organization } from '../../models/Models';

// Admin screen to manage the approver registry (README §6).
// Approvers are mapped to Location + (optional) Team; a location-wide default
// (no team, is_default) is the fallback used at ticket creation.
@Component({
  selector: 'app-approver-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './approver-management.component.html',
  styleUrls: ['./approver-management.component.css'],
})
export class ApproverManagementComponent implements OnInit {
  approvers: Approver[] = [];
  locations: Location[] = [];
  teams: Team[] = [];
  organizations: Organization[] = [];

  loading = false;
  saving = false;
  deletingId: number | null = null;
  error = '';
  success = '';

  // form model
  editingId: number | null = null;
  form: Approver = this.blankForm();

  constructor(
    private approverSvc: ApproverService,
    private locationSvc: LocationService,
    private teamSvc: TeamService,
    private orgSvc: OrganizationService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  blankForm(): Approver {
    return {
      location_id: 0,
      team_id: null,
      org_id: null,
      approver_email: '',
      approver_name: '',
      is_default: false,
      is_active: true,
    };
  }

  loadAll(): void {
    this.loading = true;
    this.approverSvc.list().subscribe({
      next: (rows) => { this.approvers = rows; this.loading = false; },
      error: (e) => { this.error = e?.error?.message || 'Failed to load approvers'; this.loading = false; },
    });
    this.locationSvc.getLocations().subscribe({ next: (r) => (this.locations = r) });
    this.teamSvc.getAllTeams().subscribe({ next: (r) => (this.teams = r) });
    this.orgSvc.getAllOrganizations().subscribe({ next: (r) => (this.organizations = r) });
  }

  // Teams filtered to the selected location (a team belongs to one location).
  teamsForLocation(): Team[] {
    if (!this.form.location_id) return [];
    return this.teams.filter((t) => Number(t.location_id) === Number(this.form.location_id));
  }

  edit(a: Approver): void {
    this.editingId = a.approver_id ?? null;
    this.form = { ...a };
    this.clearMessages();
  }

  cancel(): void {
    this.editingId = null;
    this.form = this.blankForm();
    this.clearMessages();
  }

  save(): void {
    if (this.saving) return;                       // guard against double-submit
    this.clearMessages();
    if (!this.form.location_id || !this.form.approver_email) {
      this.error = 'Location and approver email are required.';
      return;
    }
    // Normalise: a location-wide default has no team.
    if (this.form.is_default) this.form.team_id = null;

    this.saving = true;
    const done = (msg: string) => { this.saving = false; this.success = msg; this.cancel(); this.loadAll(); };
    const fail = (e: any) => { this.saving = false; this.error = e?.error?.message || 'Save failed'; };

    if (this.editingId) {
      this.approverSvc.update(this.editingId, this.form).subscribe({ next: () => done('Approver updated'), error: fail });
    } else {
      this.approverSvc.create(this.form).subscribe({ next: () => done('Approver added'), error: fail });
    }
  }

  remove(a: Approver): void {
    if (!a.approver_id || this.deletingId) return;
    if (!confirm(`Remove approver ${a.approver_email}?`)) return;
    this.clearMessages();
    this.deletingId = a.approver_id;
    this.approverSvc.remove(a.approver_id).subscribe({
      next: () => { this.deletingId = null; this.success = 'Approver removed'; this.loadAll(); },
      error: (e) => { this.deletingId = null; this.error = e?.error?.message || 'Delete failed'; },
    });
  }

  private clearMessages(): void { this.error = ''; this.success = ''; }
}
