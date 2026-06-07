import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User, Wing, Organization } from '../../models/Models';
import { GenerateTicket, MyTicket, UpdateTicket } from '../../models/Models';
import { TeamService } from '../../services/team.service';
import { Team } from '../../models/Models';
import { LocationService } from '../../services/location.service';
import { WingService } from '../../services/wing.service';
import { ClientService } from '../../services/client.service';
import { Client } from '../../models/Models';
import { Location } from '../../models/Models';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TicketType,
  TICKET_TYPES,
  ISSUE_OPTIONS,
  ASSIGNED_TO_TEAMS,
  ASSIGNED_TO_HANSA_CEQUITY,
  ASSIGNED_TO_HANSA_DIRECT_AUTOSENSE,
  ASSIGNED_TO_EMAIL_MAP,
  CLIENT_LOCATION_MAP,
  LOCATION_CLIENT_MAP,
  ORG_ISSUE_MAP,
  STATUS_OPTIONS_G,
  HANSA_CEQUITY_ISSUES,
  HANSA_DIRECT_AUTOSENSE_ISSUES,
  ORGANIZATIONS,
} from './dashboard-list.Mapping';
import { OrganizationService } from '../../services/organization.service';
import { environment } from '../../environments/environment';
import { CommentService } from '../../services/comment.service';
import { TicketComment, Approver } from '../../models/Models';
import { ApproverService } from '../../services/approver.service';

export enum SidebarTab {
  Dashboard   = 'dashboard',
  ViewTickets = 'viewTickets',
  Users       = 'users',
  Teams       = 'teams',
  NewTicket   = 'newTicket',
}

interface PaginationConfig {
  page: number;
  perPage: number;
  total: number;
  showingFrom: number;
  showingTo: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './dashboard-list.component.html',
  styleUrls: ['./dashboard-list.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  /* ---------------- ASSIGN MODAL ---------------- */
  assignForm!: FormGroup;
  showAssignModal = false;
  selectedAssignTicket: MyTicket | null = null;
  filteredAssignUsers: User[] = [];

  Math = Math;
  entriesOptions = [6, 12, 18, 24];

  dashboardPagination: PaginationConfig = { page: 1, perPage: 6, total: 0, showingFrom: 0, showingTo: 0 };
  ticketsPagination:   PaginationConfig = { page: 1, perPage: 9, total: 0, showingFrom: 0, showingTo: 0 };
  closedPagination:    PaginationConfig = { page: 1, perPage: 9, total: 0, showingFrom: 0, showingTo: 0 };

  dashboardOrganization = 'HANSA CEQUITY';
  userOrganization      = 'HANSA CEQUITY';
  assignOrganization    = 'HANSA CEQUITY';
  organizations: string[]        = ORGANIZATIONS;
  allOrganizationObjects: Organization[] = [];

  ngAfterViewInit(): void {}

  /* ---------------- TICKETS ---------------- */
  closedTickets:       MyTicket[] = [];
  allTickets:          MyTicket[] = []; // full unfiltered cache
  tickets:             MyTicket[] = [];
  dateFilteredTickets: MyTicket[] = [];
  filteredTickets:     MyTicket[] = [];
  assignedTeams:       string[]   = [];

  /* ---------------- USER ---------------- */
  userId!: number;
  allUsers:      User[]   = [];
  assignedUsers: User[]   = [];
  filteredUsers: User[]   = [];
  allEmails:     string[] = [];
  filteredEmails:         string[] = [];
  showEmailSuggestions             = false;
  filteredEmailsForEmailId:        string[] = [];
  showEmailSuggestionsForEmailId   = false;
  filteredTeams: Team[] = [];

  ticketTypes: TicketType[] = TICKET_TYPES;

  /* ── Issue dropdown ── */
  reasons:   string[] = ISSUE_OPTIONS;
  allIssues: any[]    = [];

  /* ── Approver dropdown (filtered to the creator's location) ── */
  approverOptions: Approver[] = [];

  /* ── Wing / Desk ── */
  showWingDeskFields = false;

  isSaving   = false;
  creatingTicket = false;   // loading state for the Create/Update Ticket button
  teams:     Team[]     = [];
  locations: Location[] = [];
  wings:     Wing[]     = [];
  clients:   Client[]   = [];

  showAiroliWingSelector = false;
  airoliWings: string[] = ['A', 'B', 'C', 'D'];

  /* ---------------- DATE FILTER STATE ---------------- */
  selectedRange: 'thisWeek' | 'lastWeek' | 'allTime' | 'custom' = 'thisWeek';
  startDate        = '';
  endDate          = '';
  customStartDate  = '';
  customEndDate    = '';
  showCustomDatePicker = false;
  customDateError  = '';

  /* ---------------- UI STATE ---------------- */
  activeSidebarTab: 'dashboard' | 'viewTickets' | 'closedTickets' | 'users' | 'teams' | 'newTicket' = 'dashboard';
  dashboardView:    'cards' | 'list' = 'cards';
  ticketsView:      'cards' | 'list' = 'cards';
  closedTicketsView:'cards' | 'list' = 'cards';
  activeTicketTab:  'all' | 'wip' | 'open' | 'closed' = 'all';

  editingTicket: any     = null;
  showNewTicketForm      = false;
  totalRaised    = 0;
  totalResolved  = 0;
  totalPaused    = 0;
  openCount      = 0;
  wipCount       = 0;
  closedCount    = 0;
  allCount       = 0;

  /* ── ROLE FLAGS ──
     isAdmin        = 'Admin'       — full org-switcher, all tickets across ALL locations/orgs
     isManager      = alias of isAdmin (kept for HTML template backward compatibility)
     isITService    = 'IT Services' — sees tickets for their assigned location only
     isDBA          = 'DBA'         — only tickets assigned to DBA team at their location
     isSiteManager  = 'Manager'     — location-scoped tickets
     isEmployee     = 'Employee'    — only tickets assigned to them
     isUser         = 'User'        — only their own created tickets  */
  isAdmin       = false;
  isManager     = false; // alias of isAdmin kept for HTML template compatibility
  isITService   = false;
  isDBA         = false;
  isSiteManager = false;
  isEmployee    = false;
  isUser        = false;

  currentUser!: User;
  dropdownOpen  = false;
  selectedTicket: any = null;
  isLoading     = false;

  /* ---------------- NAVBAR ---------------- */
  loggedInUser: User | null = null;
  username           = '';
  searchTerm         = '';
  showDropdown       = false;
  notificationCount  = 0;
  private sub        = new Subscription();

  /* ---------------- TICKET FORM ---------------- */
  ticketForm!: FormGroup;
  isDeleting         = false;
  showTicketMenu     = false;
  selectedFile: File | null = null;
  showAttachmentModal       = false;
  currentAttachmentUrl: string | null = null;

  /* ---------------- TEAM FORM ---------------- */
  teamForm!: FormGroup;
  showTeamForm  = false;
  editingTeam: Team | null = null;
  successMessage = '';
  errorMessage   = '';
  statuses   = STATUS_OPTIONS;
  G_status   = STATUS_OPTIONS_G;
  priorities = PRIORITY_OPTIONS;

  /* ---------------- USER FORM ---------------- */
  userForm!: FormGroup;
  showUserForm  = false;
  editingUser: User | null = null;

  /* ---------------- REASSIGN ON DELETE ---------------- */
  showReassignModal       = false;
  userToDeleteId: number | null = null;
  userToDeleteName        = '';
  pendingTicketCount      = 0;
  availableReassignUsers: User[] = [];
  selectedReassignUserId: number | null = null;

  /* ── COMMENTS ── */
  ticketComments:   TicketComment[] = [];
  newCommentText    = '';
  isSubmittingComment = false;
  commentError        = '';
  isOwnerOfSelectedTicket = false;
  canCommentOnTicket      = false;

  /* ---------------- NOTIFICATIONS ---------------- */
  notifications:          any[] = [];
  unreadNotifications     = 0;
  showNotificationDropdown = false;

  /* ---------------- PAGINATION ---------------- */
  selectedEntries   = 6;
  currentPage       = 1;
  closedTicketPage  = 1;
  closedTicketsPerPage = 9;
  closedShowingFrom = 0;
  closedShowingTo   = 0;
  userPage          = 1;
  usersPerPage      = 10;
  teamPage          = 1;
  teamsPerPage      = 10;

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private authService: AuthService,
    private userService: UserService,
    private teamService: TeamService,
    private router: Router,
    private http: HttpClient,
    private locationService: LocationService,
    private wingService: WingService,
    private clientService: ClientService,
    private organizationService: OrganizationService,
    private commentService: CommentService,
    private approverService: ApproverService,
    private ChangeDetectorRef: ChangeDetectorRef,
  ) {}

  /* ============================================================
     ROLE HELPER — single source of truth for all role flags
     Rules:
       Admin       → full access, all orgs/locations, can switch org dropdown
       IT Services → location-scoped; sees all tickets at their location
       DBA         → location-scoped; sees only DBA-assigned tickets at their location
       Manager     → location-scoped; can view/edit/assign within their location
       Employee    → sees only tickets assigned to them; can update status/comments
       User        → can create tickets & view only their own tickets
  ============================================================ */
  private setRoleFlags(user: User): void {
    const team = (user.teamName || '').trim();
    const role = (user.role || '').toLowerCase();   // authoritative — set by Admin

    // ── Role (separate from team membership) ──────────────────────────────────
    this.isAdmin       = role === 'admin'   || team === 'Admin';
    this.isSiteManager = role === 'manager';                       // a real Manager
    this.isEmployee    = role === 'employee' || (!role && team === 'Employee');
    this.isUser        = role === 'user'     || (!role && team === 'User');

    // ── Team identity (which functional team they belong to) ──────────────────
    this.isITService   = team === 'IT Services' || team === 'IT Service';
    this.isDBA         = team === 'DBA';

    // Backward-compat alias: existing HTML uses `isManager` to mean admin-level.
    this.isManager     = this.isAdmin;
  }

  /* Who may ASSIGN / reassign tickets — only Admin and a real Manager (README §3). */
  get canManageTickets(): boolean { return this.isAdmin || this.isSiteManager; }

  /* Who may EDIT a ticket — Admin/Manager (full) and Employees (status only,
     enforced field-by-field in editTicket()). Users (requesters) cannot edit. */
  get canEditTickets(): boolean { return this.isAdmin || this.isSiteManager || this.isEmployee; }

  /* ============================================================
     LOCATION HELPER — resolve current user's location_id
  ============================================================ */
  private getCurrentUserLocationId(): number | null {
    return (this.currentUser as any)?.location_id ?? null;
  }

  /* ============================================================
     TICKET LOCATION FILTER — enforces location-based visibility
     Called after the raw ticket list arrives from the API.

     Admin  → sees ALL tickets; org dropdown drives further filtering.
     IT Services / Manager → sees tickets whose creation_location_id
                              matches the logged-in user's location_id.
     DBA    → sees tickets assigned to DBA team at their location.
     Employee → sees only tickets where assigned_to_id === userId.
     User   → sees only tickets where created_by_id === userId.

     IMPORTANT: ticket.created_at_location_id is the FIXED creation
     location and NEVER changes even if the user moves locations later.
  ============================================================ */
  private applyLocationVisibilityFilter(tickets: MyTicket[]): MyTicket[] {
    // Visibility is now enforced SERVER-SIDE for every endpoint (role + location).
    // We trust the scoped response and do not re-filter on the client (which
    // previously read a `created_at_location_id` field the API never returns and
    // could blank out valid lists). Admin org-switch narrowing is handled
    // separately by applyOrganizationFilter().
    return Array.isArray(tickets) ? tickets : [];
  }

  /* ============================================================
     ISSUE DROPDOWN — org-aware list
  ============================================================ */
  private setReasons(): void {
    const orgRaw        = (this.currentUser?.orgName || '').trim().toLowerCase();
    const isHansaDirect = orgRaw.includes('hansa direct');
    const isAutosense   = orgRaw.includes('autosense');

    // Drive the Issue dropdown from the DATABASE so admin-added issues appear and
    // can auto-route (issue → mapped team, README §7). Fall back to the static
    // map only if issues haven't loaded yet.
    if (this.allIssues.length > 0) {
      this.reasons = this.allIssues
        .map((i: any) => i.issue_name)
        .filter((n: string) => !!n);
    } else {
      this.reasons = (isHansaDirect || isAutosense)
        ? ORG_ISSUE_MAP['HANSA DIRECT']
        : ORG_ISSUE_MAP['HANSA CEQUITY'];
    }
  }

  private setAssignedTeams(): void {
    const orgRaw = (this.currentUser?.orgName || '').toLowerCase().trim();
    this.assignedTeams = (orgRaw.includes('hansa direct') || orgRaw.includes('autosense'))
      ? ASSIGNED_TO_HANSA_DIRECT_AUTOSENSE
      : ASSIGNED_TO_HANSA_CEQUITY;
  }

  /* ============================================================
     WING / DESK VISIBILITY
  ============================================================ */
  private updateWingDeskVisibility(): void {
    if (!this.currentUser) { this.showWingDeskFields = false; return; }
    const org = (this.currentUser.orgName || '').toLowerCase().trim();
    this.showWingDeskFields = org.includes('hansa direct') || org.includes('autosense');
  }

  /* ============================================================
     ngOnInit
  ============================================================ */
  ngOnInit(): void {
    this.authService.startActivityWatcher();
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login']); return; }

    const user = this.authService.getCurrentUser();
    if (!user)  { this.router.navigate(['/login']); return; }

    this.currentUser = user;
    this.userId      = user.id;
    this.setRoleFlags(user);

    this.loggedInUser = user;
    this.username     = `${user.firstName} ${user.lastName}`;

    const cachedOrg           = (user.orgName || 'HANSA CEQUITY').toUpperCase().trim();
    this.dashboardOrganization = cachedOrg;
    this.userOrganization      = cachedOrg;
    this.assignOrganization    = cachedOrg;

    this.initUserForm();
    this.initTicketForm(user);
    this.initTeamForm();
    this.initAssignForm();

    const today      = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek  = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    this.selectedRange = 'thisWeek';
    this.startDate     = startOfWeek.toISOString().split('T')[0];
    this.endDate       = endOfWeek.toISOString().split('T')[0];

    this.loadOrganizations();
    this.loadTeams();
    this.loadLocations();
    this.loadWings();
    this.loadClients();
    this.loadEmails();

    // Refresh user from server first, then load all data
    this.userService.getUserById(user.id).subscribe({
      next: (freshUser: User) => {
        const merged = { ...user, ...freshUser };
        localStorage.setItem('user', JSON.stringify(merged));
        this.currentUser = merged;
        this.setRoleFlags(merged);

        const freshOrg            = (merged.orgName || 'HANSA CEQUITY').toUpperCase().trim();
        this.dashboardOrganization = freshOrg;
        this.userOrganization      = freshOrg;
        this.assignOrganization    = freshOrg;

        this.updateWingDeskVisibility();
        this.setAssignedTeams();
        this.loadIssues();
        this.loadAllUsers();
        this.loadTickets();
        this.loadClosedTickets();
      },
      error: () => {
        this.updateWingDeskVisibility();
        this.setAssignedTeams();
        this.loadIssues();
        this.loadAllUsers();
        this.loadTickets();
        this.loadClosedTickets();
      },
    });

    this.sub.add(
      this.authService.currentUser$.subscribe((u) => {
        this.loggedInUser = u;
        this.username     = u ? `${u.firstName} ${u.lastName}` : '';
      })
    );

    this.ChangeDetectorRef.detectChanges();
  }

  /* ============================================================
     SIDEBAR TAB
  ============================================================ */
  setSidebarTab(tab: 'dashboard' | 'viewTickets' | 'closedTickets' | 'newTicket' | 'users' | 'teams'): void {
    this.activeSidebarTab  = tab;
    this.selectedTicket    = null;
    this.showNewTicketForm = false;
    this.showUserForm      = false;
    this.showTeamForm      = false;
    this.showTicketMenu    = false;
    this.errorMessage      = ''; // clear stale errors on tab switch
    this.ChangeDetectorRef.detectChanges();

    if (tab === 'viewTickets') {
      if (this.tickets.length === 0) { this.loadTickets(); } else { this.applyAllFilters(); }
    }
    if (tab === 'closedTickets') {
      this.closedTicketPage      = 1;
      this.closedPagination.page = 1;
      this.loadClosedTickets();
    }
    if (tab === 'dashboard') { this.showCustomDatePicker = false; this.applyAllFilters(); }
    if (tab === 'users')  { this.loadAllUsers(); if (this.allUsers.length > 0) { this.applyUserOrgFilter(); } }
    if (tab === 'teams')  { this.loadTeams(); }
  }

  openUserTab():   void { this.setSidebarTab('users'); }
  openTicketTab(): void { this.setSidebarTab('viewTickets'); }

  openAssignModal(ticket: MyTicket): void {
    // Only Admin and the Manager of the ticket's team+location may assign (README §3).
    if (!this.canManageTickets) return;

    // Location check: non-Admin can only assign tickets from their location
    if (!this.isAdmin) {
      const userLocId = this.getCurrentUserLocationId();
      const ticketLocId =
        (ticket as any).created_at_location_id ??
        (ticket as any).location_id ??
        null;
      if (userLocId && ticketLocId && ticketLocId !== userLocId) {
        alert('You can only assign tickets from your own location.');
        return;
      }
    }

    this.selectedAssignTicket = ticket;
    this.showAssignModal      = true;
    this.assignForm.reset();
    this.assignForm.patchValue({ orgName: this.assignOrganization });
    this.loadAssignableForTicket(ticket);
  }

  /* Assignable employees for THIS ticket's team + location (backend-validated set). */
  private loadAssignableForTicket(ticket: MyTicket): void {
    this.filteredAssignUsers = [];
    const teamId = (ticket as any).assigned_team_id;
    const locId  = (ticket as any).location_id;
    this.userService.getAssignableUsers(teamId, locId).subscribe({
      next: (users) => { this.filteredAssignUsers = users || []; this.ChangeDetectorRef.detectChanges(); },
      error: () => { this.filteredAssignUsers = []; this.ChangeDetectorRef.detectChanges(); },
    });
  }

  /* ============================================================
     LOAD TICKETS
     Visibility rules:
       Admin       → getAll() — all orgs, all locations; org dropdown narrows further
       IT Services → getAll() filtered by user's location_id on client side
                     (ensures location-A IT cannot see location-B tickets)
       DBA         → getTicketsByAssignedTeam('DBA') filtered by user's location_id
       Manager     → getTicketsByLocation(locationId)
       Employee    → getMyTickets(userId) — only assigned tickets
       User        → getMyTickets(userId) — only created tickets
  ============================================================ */
  loadTickets(): void {
    if (!this.currentUser) return;

    const teamName   = (this.currentUser.teamName || '').trim();
    const locationId = this.getCurrentUserLocationId();

    let request$: Observable<MyTicket[]>;

    console.log('loadTickets teamName:', JSON.stringify(teamName),
                '| isAdmin:', this.isAdmin, '| isDBA:', this.isDBA,
                '| isITService:', this.isITService, '| isSiteManager:', this.isSiteManager,
                '| locationId:', locationId);

    // Branch by ROLE (not team). The backend scopes every endpoint, so we just
    // call the right one for the role.
    if (this.isAdmin) {
      request$ = this.ticketService.getAll();                       // all orgs/locations
    } else if (this.isSiteManager) {
      request$ = locationId
        ? this.ticketService.getTicketsByLocation(locationId)       // own team+location (server-scoped)
        : this.ticketService.getAll();
    } else {
      // Employee / User → only their own (assigned or created)
      request$ = this.ticketService.getMyTickets(this.userId);
    }

    request$.subscribe({
      next: (tickets: MyTicket[]) => {
        const rawTickets = Array.isArray(tickets) ? tickets : [];

        // Apply location-based visibility filter for non-Admin roles
        const locationFiltered = this.applyLocationVisibilityFilter(rawTickets);

        this.tickets    = locationFiltered;
        this.allTickets = rawTickets; // keep raw (unfiltered) cache for Admin org-switching

        this.applyDateFilter();
        this.applyOrganizationFilter();
        this.applyTabFilter();
        this.calculateCounts();

        this.dashboardPagination.page = 1;
        this.ticketsPagination.page   = 1;

        const currentUserName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
        const activeStatuses  = ['Open', 'Reopened', 'In Progress'];

        this.notificationCount = this.tickets.filter(t => {
          const isActive = activeStatuses.includes(t.status_name);
          if (this.isAdmin || this.isITService) { return t.assigned_to_name === currentUserName && isActive; }
          return isActive;
        }).length;

        this.ChangeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('LOAD TICKETS FAILED:', err);
        this.errorMessage = err.message || 'Failed to load tickets';
        this.ChangeDetectorRef.detectChanges();
      },
    });
  }

  /* ============================================================
     LOAD CLOSED TICKETS
     Same location-visibility rules as loadTickets().
     Uses allTickets cache for Admin/IT to avoid a second HTTP call.
  ============================================================ */
  loadClosedTickets(): void {
    const userId         = this.authService.getCurrentUserId() ?? 0;
    const closedStatuses = ['closed', 'resolved'];
    const selectedOrg    = this.dashboardOrganization.toLowerCase().trim();
    const locationId     = this.getCurrentUserLocationId();

    const applyClosedFilter = (tickets: MyTicket[]): MyTicket[] => {
      const safe = Array.isArray(tickets) ? tickets : [];

      // First apply location visibility
      const locationFiltered = this.applyLocationVisibilityFilter(safe);

      // Then filter to only closed/resolved status
      return locationFiltered.filter(ticket => {
        const status = (ticket.status_name || '').toLowerCase();
        if (!closedStatuses.includes(status)) return false;

        // Admin additionally filters by selected org in dropdown
        if (this.isAdmin) {
          const ticketOrg = (ticket.org_name || '').toLowerCase().trim();
          return ticketOrg === selectedOrg;
        }

        return true;
      });
    };

    // Reuse the already-loaded (server-scoped) cache to avoid a second call.
    if (this.allTickets.length > 0 && (this.isAdmin || this.isSiteManager)) {
      this.closedTickets          = applyClosedFilter(this.allTickets);
      this.closedPagination.page  = 1;
      this.closedPagination.total = this.closedTickets.length;
      this.ChangeDetectorRef.detectChanges();
      return;
    }

    let request$: Observable<MyTicket[]>;

    // Branch by ROLE, matching loadTickets().
    if (this.isAdmin) {
      request$ = this.ticketService.getAll();
    } else if (this.isSiteManager) {
      request$ = locationId
        ? this.ticketService.getTicketsByLocation(locationId)
        : this.ticketService.getAll();
    } else {
      request$ = this.ticketService.getMyTickets(userId);
    }

    request$.subscribe({
      next: (tickets: MyTicket[]) => {
        this.closedTickets          = applyClosedFilter(tickets);
        this.closedPagination.page  = 1;
        this.closedPagination.total = this.closedTickets.length;
        this.ChangeDetectorRef.detectChanges();
      },
      error: (err: any) => {
        console.error('LOAD CLOSED TICKETS ERROR:', err);
        if (this.activeSidebarTab === 'closedTickets') {
          this.errorMessage = 'Failed to load closed tickets.';
        }
        this.ChangeDetectorRef.detectChanges();
      },
    });
  }

  /* ============================================================
     FORMS — INIT
  ============================================================ */
  private initTeamForm(): void {
    this.teamForm = this.fb.group({
      team_name:     ['', Validators.required],
      location_name: ['', Validators.required],
    });
  }

  private initUserForm(): void {
    this.userForm = this.fb.group({
      employee_id:  [''],
      firstName:    ['', [Validators.required]],
      lastName:     ['', [Validators.required]],
      email:        ['', [Validators.required, Validators.email]],
      password:     [''],
      teamName:     [{ value: '', disabled: false }, [Validators.required]],
      role:         ['employee', [Validators.required]],   // admin sets role at creation
      locationName: ['', [Validators.required]],           // required — unblocks ticket creation
      wingName:     [''],
      airoliWing:   [''],
      orgName:      [null],
    });
  }

  onUserFormOrgChange(selectedOrg: string | null): void {
    if (!selectedOrg) { this.showAiroliWingSelector = false; this.userForm.patchValue({ wingName: '', airoliWing: '' }); return; }
    const orgUpper = selectedOrg.toUpperCase().trim();
    const wingMap: { [key: string]: string } = {
      'HANSA CEQUITY': 'Mumbai Kurla',
      'HANSA DIRECT':  'Mumbai Airoli',
      'AUTOSENSE':     'Chennai',
    };
    const matchedKey = Object.keys(wingMap).find(k => k === orgUpper);
    const wing       = matchedKey ? wingMap[matchedKey] : '';
    this.showAiroliWingSelector = orgUpper.includes('HANSA DIRECT');
    this.userForm.patchValue({ wingName: wing, airoliWing: '' });
  }

  private initTicketForm(currentUser: User): void {
    this.ticketForm = this.fb.group({
      subject:          ['', Validators.required],
      email_id:         ['', [Validators.required]],
      created_by_name:  [{ value: `${currentUser.firstName} ${currentUser.lastName}`, disabled: true }],
      issue_name:       ['', Validators.required],
      team_name:        [{ value: currentUser.teamName || '', disabled: true }],
      type_name:        ['IT Services', Validators.required],
      assigned_to_name: [this.assignedTeams[0] || ''],
      status_name:      ['Open'],
      priority:         ['Low'],
      description:      [''],
      additional_email: [''],
      attachment:       [''],
      client_name:      ['', Validators.required],
      approver_email:   [''],   // optional; auto-selected server-side if left blank
      wing_name:        [''],
      desk_number:      [''],
    });

    this.ticketForm.get('email_id')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((v: string) => this.handleEmailSearch(v, 'primary'));

    this.ticketForm.get('additional_email')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((v: string) => this.handleEmailSearch(v, 'additional'));
  }

  initAssignForm(): void {
    this.assignForm = this.fb.group({
      orgName:          ['', Validators.required],
      assignedTo:       ['', Validators.required],
      estimatedEndDate: ['', Validators.required],
      remark:           [''],
    });
    this.assignForm.get('orgName')?.valueChanges.subscribe(() => this.filterAssignUsers());
  }

  private handleEmailSearch(value: string, type: 'primary' | 'additional'): void {
    const val        = value?.toLowerCase().trim() || '';
    const searchTerm = type === 'primary' ? val.split(',').pop()?.trim() || '' : val;

    if (searchTerm.length < 1) {
      if (type === 'primary') { this.filteredEmailsForEmailId = []; this.showEmailSuggestionsForEmailId = false; }
      else                    { this.filteredEmails = []; this.showEmailSuggestions = false; }
      return;
    }

    const alreadySelected = type === 'primary'
      ? val.split(',').map((e: string) => e.trim().toLowerCase()).filter((e: string) => !!e && e !== searchTerm)
      : [];

    const filtered = this.allEmails.filter(email => {
      const el = email.toLowerCase();
      return el.includes(searchTerm) && !alreadySelected.includes(el);
    });

    if (type === 'primary') { this.filteredEmailsForEmailId = filtered; this.showEmailSuggestionsForEmailId = filtered.length > 0; }
    else                    { this.filteredEmails = filtered; this.showEmailSuggestions = filtered.length > 0; }
  }

  /* ============================================================
     TEAM CRUD
  ============================================================ */
  saveTeam(): void {
    if (this.teamForm.invalid || this.isSaving) return;
    this.isSaving = true;
    const selectedLocation = this.locations.find(loc => loc.location_name === this.teamForm.value.location_name);
    const payload: Partial<Team> = {
      team_name:     this.teamForm.value.team_name,
      location_name: this.teamForm.value.location_name,
      location_id:   selectedLocation?.location_id,
    };
    if (this.editingTeam) {
      this.teamService.updateTeam(this.editingTeam.team_id!, payload).subscribe({
        next: () => { this.loadTeams(); this.showTeamForm = false; this.successMessage = 'Team updated successfully.'; this.isSaving = false; },
        error: (err) => { this.errorMessage = err.error?.message || 'Failed to update team.'; this.isSaving = false; },
      });
    } else {
      this.teamService.createTeam(payload).subscribe({
        next: () => { this.loadTeams(); this.showTeamForm = false; this.successMessage = 'Team created successfully.'; this.isSaving = false; },
        error: (err) => { this.errorMessage = err.error?.message || 'Failed to create team.'; this.isSaving = false; },
      });
    }
  }

  deleteTeam(id: number): void {
    if (!confirm('Are you sure you want to delete this team?')) return;
    this.teamService.deleteTeam(id).subscribe({
      next: () => { this.loadTeams(); this.successMessage = 'Team deleted successfully.'; },
      error: (err) => { this.errorMessage = err.error?.message || 'Failed to delete team.'; },
    });
  }

  openCreateTeamForm(): void {
    this.showTeamForm      = true;
    this.editingTeam       = null;
    this.selectedTicket    = null;
    this.showNewTicketForm = false;
    this.teamForm.reset({ team_name: '', location_name: '' });
  }

  editTeam(team: Team): void {
    this.showTeamForm = true;
    this.editingTeam  = team;
    this.teamForm.patchValue({ team_name: team.team_name, location_name: team.location_name || '' });
  }

  closeTeamForm(): void { this.showTeamForm = false; }

  /* ============================================================
     USER CRUD
  ============================================================ */
  editUser(user: User): void {
    this.showUserForm = true;
    this.editingUser  = user;
    const orgUpper    = (user.orgName || '').toUpperCase().trim();
    const isAiroli    = orgUpper.includes('HANSA DIRECT');
    this.showAiroliWingSelector = isAiroli;
    this.userForm.patchValue({
      firstName:  user.firstName,
      lastName:   user.lastName,
      email:      user.email,
      password:   '',
      teamName:   user.teamName,
      role:       (user.role || 'employee'),
      locationName: user.locationName || '',
      orgName:    user.orgName || null,
      wingName:   isAiroli ? 'Mumbai Airoli' : (user.locationName || user.wingName || ''),
      airoliWing: isAiroli ? (user.wingName || '') : '',
    });
  }

  closeUserForm(): void { this.showUserForm = false; this.errorMessage = ''; this.successMessage = ''; }

  saveUser(): void {
    if (this.userForm.invalid || this.isSaving) return;
    this.isSaving = true;
    const form = this.userForm.getRawValue();

    const isAiroli       = (form.orgName || '').toLowerCase().includes('hansa direct');
    const isAutosense    = (form.orgName || '').toLowerCase().includes('autosense');
    const isHansaCequity = (form.orgName || '').toLowerCase().includes('hansa cequity');

    let wing_name: string | null = null;
    if (isAiroli)            { wing_name = form.airoliWing || null; }
    else if (isAutosense)    { wing_name = 'Chennai'; }
    else if (isHansaCequity) { wing_name = 'Mumbai Kurla'; }

    const payload: any = {
      first_name:    form.firstName,
      last_name:     form.lastName,
      email_id:      form.email,
      team_name:     form.teamName,
      role:          form.role || 'employee',
      org_name:      form.orgName || null,
      wing_name:     wing_name,
      location_name: form.locationName || null,
    };

    if (!this.editingUser) {
      if (!form.employee_id) { this.errorMessage = 'Employee ID is required.'; this.isSaving = false; return; }
      if (!form.password)    { this.errorMessage = 'Password is required.';    this.isSaving = false; return; }
      payload.employee_id = form.employee_id;
      payload.password    = form.password;
    } else {
      if (form.password) { payload.password = form.password; }
    }

    if (this.editingUser) {
      this.userService.updateUser(this.editingUser.id, payload).subscribe({
        next: () => { this.loadAllUsers(); this.showUserForm = false; this.successMessage = 'User updated successfully.'; this.isSaving = false; this.ChangeDetectorRef.detectChanges(); },
        error: (err) => { this.errorMessage = err.error?.message || 'Failed to update user.'; this.isSaving = false; this.ChangeDetectorRef.detectChanges(); },
      });
    } else {
      this.userService.createUser(payload).subscribe({
        next: () => { this.loadAllUsers(); this.showUserForm = false; this.successMessage = 'User created successfully.'; this.isSaving = false; this.ChangeDetectorRef.detectChanges(); },
        error: (err) => { this.errorMessage = err.error?.message || 'Failed to create user.'; this.isSaving = false; this.ChangeDetectorRef.detectChanges(); },
      });
    }
  }

  deleteUser(id: number): void {
    if (this.isDeleting) return;
    const user = this.allUsers.find((u) => u.id === id);
    if (!user) return;
    const userName = `${user.firstName} ${user.lastName}`;
    this.userToDeleteId         = id;
    this.userToDeleteName       = userName;
    this.availableReassignUsers = this.allUsers.filter((u) => u.id !== id);
    this.selectedReassignUserId = null;

    this.ticketService.getTicketsByUser(id).subscribe({
      next: (tickets) => {
        const pending = tickets.filter(t =>
          t.status_name === 'Open' || t.status_name === 'Reopened' || t.status_name === 'In Progress'
        );
        if (pending.length > 0) { this.pendingTicketCount = pending.length; this.showReassignModal = true; }
        else {
          const ok = confirm(`Are you sure you want to delete "${userName}"?\nThis action cannot be undone.`);
          if (ok) { this.finalDeleteUser(id, userName); }
          else    { this.userToDeleteId = null; this.userToDeleteName = ''; }
        }
      },
      error: () => { alert('Failed to check user tickets. Please try again.'); this.userToDeleteId = null; this.userToDeleteName = ''; },
    });
  }

  confirmReassignAndDelete(): void {
    if (!this.selectedReassignUserId) { alert('Please select a user to reassign the tickets to.'); return; }
    if (!this.userToDeleteId) return;
    const reassignUser = this.allUsers.find((u) => u.id === this.selectedReassignUserId);
    if (!reassignUser) return;
    const msg = `${this.pendingTicketCount} pending ticket(s) will be reassigned to "${reassignUser.firstName} ${reassignUser.lastName}".\n\nThen "${this.userToDeleteName}" will be permanently deleted.\n\nProceed?`;
    if (!confirm(msg)) return;
    this.isDeleting = true;
    this.userService.reassignTickets(this.userToDeleteId, this.selectedReassignUserId).subscribe({
      next: () => {
        this.userService.deleteUser(this.userToDeleteId!, undefined).subscribe({
          next: () => { alert(`Tickets reassigned and user "${this.userToDeleteName}" deleted successfully.`); this.showReassignModal = false; this.closeReassignModal(); this.loadAllUsers(); this.isDeleting = false; },
          error: (err) => { alert(err.error?.message || 'Tickets reassigned but failed to delete user.'); this.isDeleting = false; this.loadAllUsers(); },
        });
      },
      error: (err) => { alert(err.error?.message || 'Failed to reassign tickets. Please try again.'); this.isDeleting = false; },
    });
  }

  private finalDeleteUser(id: number, userName: string): void {
    this.isDeleting = true;
    this.userService.deleteUser(id, undefined).subscribe({
      next: () => { alert(`User "${userName}" deleted successfully.`); this.loadAllUsers(); this.isDeleting = false; },
      error: (err) => {
        if (err.status === 400 && err.error?.requiresReassign) { this.pendingTicketCount = err.error.pendingCount || 0; this.showReassignModal = true; this.isDeleting = false; return; }
        alert(err.error?.message || 'Failed to delete user.'); this.isDeleting = false;
      },
    });
  }

  closeReassignModal(): void {
    this.showReassignModal      = false;
    this.userToDeleteId         = null;
    this.userToDeleteName       = '';
    this.pendingTicketCount     = 0;
    this.selectedReassignUserId = null;
  }

  /* ============================================================
     TICKET CRUD
  ============================================================ */
  openNewTicketForm(): void {
    if (!this.currentUser) return;
    this.activeSidebarTab  = 'viewTickets';
    this.showNewTicketForm = true;
    this.selectedTicket    = null;
    this.selectedFile      = null;
    this.editingTicket     = null;
    this.initTicketForm(this.currentUser);
    this.ticketForm.patchValue({
      priority:         'Low',
      type_name:        'IT Services',
      assigned_to_name: this.assignedTeams[0] || '',
    });
    this.loadAssignedUsers();
    this.updateWingDeskVisibility();
    this.setReasons();
    this.loadApproverOptions();
  }

  /* Approver choices for the ticket form, filtered to the creator's location. */
  loadApproverOptions(): void {
    const locationId = this.getCurrentUserLocationId();
    if (!locationId) { this.approverOptions = []; return; }
    this.approverService.options(locationId).subscribe({
      next: (rows) => { this.approverOptions = rows || []; this.ChangeDetectorRef.detectChanges(); },
      error: () => { this.approverOptions = []; },
    });
  }

  saveNewTicket(): void {
    if (this.creatingTicket) return;   // prevent double-submit
    if (this.ticketForm.invalid) { this.ticketForm.markAllAsTouched(); this.errorMessage = 'Please fill in all required fields.'; return; }

    const raw           = this.ticketForm.getRawValue();
    const cleanEmailId  = (raw.email_id || '').split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0).join(', ');
    const assignedTeam  = raw.assigned_to_name?.trim() || '';
    const assignedEmail = assignedTeam ? (ASSIGNED_TO_EMAIL_MAP[assignedTeam] || '') : '';
    const description   = this.ticketForm.get('description')?.value || '';

    const selectedWing   = this.wings.find(w => w.wing_name.trim().toUpperCase() === (raw.wing_name || '').trim().toUpperCase());
    const resolvedWingId = selectedWing?.wing_id ? Number(selectedWing.wing_id) : null;

    console.log('wings available:', this.wings);
    console.log('raw.wing_name selected:', raw.wing_name);
    console.log('matched wing object:', selectedWing);
    console.log('resolvedWingId to send:', resolvedWingId);

    // Always stamp tickets with the user's current location_id at creation time.
    // This location is FIXED and will never change even if the user moves locations later.
    const locationId = this.getCurrentUserLocationId();

    const payload: any = {
      subject:                raw.subject?.trim(),
      email_id:               cleanEmailId,
      created_by_name:        raw.created_by_name?.trim(),
      issue_name:             raw.issue_name?.trim(),
      team_name:              raw.team_name?.trim(),
      type_name:              raw.type_name?.trim(),
      assigned_to_name:       assignedTeam,
      assigned_to_email:      assignedEmail,
      status_name:            raw.status_name || 'Open',
      priority:               raw.priority || 'Low',
      description:            description,
      additional_email:       raw.additional_email || '',
      client_name:            raw.client_name || '',
      // Approver picked from the filtered dropdown (blank → server auto-selects).
      approver_email:         raw.approver_email || '',
      // Use currentUser.orgName so Employee/User tickets are stamped
      // with their own org, not the Admin dropdown org.
      org_name:               this.currentUser.orgName || '',
      attachment:             this.selectedFile || null,
      wing_id:                resolvedWingId,
      // IMPORTANT: location_id and created_at_location_id are stamped at
      // creation time and must never be changed by reassignment or user transfer.
      location_id:            locationId,
      created_at_location_id: locationId,
    };

    console.log('Payload JSON:', JSON.stringify(payload, null, 2));

    if (this.showWingDeskFields) {
      payload.wing_name   = raw.wing_name   || null;
      payload.desk_number = raw.desk_number || null;
    }

    this.creatingTicket = true;
    if (this.editingTicket) {
      this.ticketService.update(this.editingTicket.ticket_id, payload).subscribe({
        next: () => { this.creatingTicket = false; alert('Ticket updated successfully!'); this.closeNewTicketForm(); this.loadTickets(); },
        error: (err) => { this.creatingTicket = false; this.errorMessage = err.message || 'Failed to update ticket.'; },
      });
    } else {
      this.ticketService.create(payload).subscribe({
        next: () => { this.creatingTicket = false; alert('Ticket created successfully!'); this.closeNewTicketForm(); this.loadTickets(); },
        error: (err) => { this.creatingTicket = false; this.errorMessage = err.message || 'Failed to create ticket.'; },
      });
    }
  }

  editTicket(ticket: MyTicket): void {
    // Permission check: Employees cannot edit tickets they don't own; Users cannot edit at all
    if (this.isUser) return;

    // Location check: non-Admin users cannot edit tickets from other locations
    if (!this.isAdmin) {
      const userLocId = this.getCurrentUserLocationId();
      const ticketLocId =
        (ticket as any).created_at_location_id ??
        (ticket as any).location_id ??
        null;
      if (userLocId && ticketLocId && ticketLocId !== userLocId) {
        alert('You can only edit tickets from your own location.');
        return;
      }
    }

    if (!this.canEditTickets) return;

    this.activeSidebarTab  = 'viewTickets';
    this.selectedTicket    = null;
    this.showNewTicketForm = true;
    this.editingTicket     = ticket;
    this.initTicketForm(this.currentUser);
    this.loadAssignedUsers();
    this.updateWingDeskVisibility();
    this.setReasons();

    this.ticketForm.patchValue({
      subject:          ticket.subject,
      email_id:         ticket.email_id,
      created_by_name:  ticket.created_by_name,
      issue_name:       ticket.issue_name,
      team_name:        ticket.team_name,
      type_name:        ticket.type_name || 'IT Services',
      assigned_to_name: ticket.assigned_to_name,
      status_name:      ticket.status_name,
      priority:         ticket.priority,
      description:      ticket.description,
      additional_email: ticket.additional_email,
      attachment:       ticket.attachment,
      client_name:      ticket.client_name || '',
      wing_name:        (ticket as any).wing_name    || '',
      desk_number:      (ticket as any).desk_number  || '',
    });

    if (this.canManageTickets) {
      this.ticketForm.get('status_name')?.enable();
      this.ticketForm.get('assigned_to_name')?.enable();
    }

    if (this.isEmployee) {
      // Employees can only update status; all other fields are locked
      this.ticketForm.get('status_name')?.enable();
      ['subject','email_id','issue_name','type_name','assigned_to_name',
       'priority','description','additional_email','client_name','wing_name','desk_number']
        .forEach(f => this.ticketForm.get(f)?.disable());
    }

    const currentUserName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    const isOwner = ticket.created_by_name === currentUserName;
    if (!isOwner && !this.isEmployee) { this.ticketForm.get('description')?.disable(); }
    else if (!this.isEmployee)         { this.ticketForm.get('description')?.enable(); }
  }

  closeNewTicketForm(): void {
    this.showNewTicketForm              = false;
    this.editingTicket                  = null;
    this.selectedTicket                 = null;
    this.selectedFile                   = null;
    this.errorMessage                   = '';
    this.filteredEmails                 = [];
    this.showEmailSuggestions           = false;
    this.filteredEmailsForEmailId       = [];
    this.showEmailSuggestionsForEmailId = false;
    this.ticketForm.get('description')?.enable();
    this.ticketForm.get('status_name')?.disable();
    this.ticketForm.reset({ status_name: 'Open', priority: 'Low', type_name: 'IT Services' });
  }

  openTicket(ticket: any): void {
    this.ticketComments = []; this.newCommentText = ''; this.commentError = '';

    const currentUserName            = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    this.isOwnerOfSelectedTicket     = ticket.created_by_name === currentUserName;

    // Comment permission (README §3): Admin & Manager always; assigned Employee;
    // and the ticket OWNER (requester) on their own ticket.
    this.canCommentOnTicket = this.canManageTickets ||
      (this.isEmployee && ticket.assigned_to_id === this.userId) ||
      this.isOwnerOfSelectedTicket;

    const resolvedWing     = this.wings.find(w => w.wing_id === ticket.wing_id);
    const resolvedWingName = resolvedWing?.wing_name || ticket.wing_name || ticket.location_name || null;

    this.selectedTicket = {
      ticket_id:        ticket.ticket_id,
      ticket_number:    ticket.ticket_number,
      subject:          ticket.subject          || 'N/A',
      created_by_name:  ticket.created_by_name  || 'N/A',
      assigned_to_name: ticket.assigned_to_name || 'N/A',
      team_name:        ticket.team_name         || 'N/A',
      type_name:        ticket.type_name         || 'N/A',
      issue_name:       ticket.issue_name        || 'N/A',
      status_name:      ticket.status_name       || 'N/A',
      priority:         ticket.priority          || 'N/A',
      email_id:         ticket.email_id          || 'N/A',
      description:      ticket.description       || '',
      created_at:       ticket.created_at,
      additional_email: ticket.additional_email  || 'N/A',
      attachment:       ticket.attachment        || null,
      client_name:      ticket.client_name       || 'N/A',
      wing_name:        resolvedWingName,
      desk_number:      ticket.desk_number       || null,
      approved_by_name: ticket.approved_by_name  || null,
      approval_status:  ticket.approval_status   || null,
      location_name:    ticket.location_name     || null,
    };

    this.ticketService.getById(ticket.ticket_id).subscribe({
      next: (data: any) => {
        const wingAfterMerge     = this.wings.find(w => w.wing_id === (data.wing_id ?? ticket.wing_id));
        const wingNameAfterMerge = wingAfterMerge?.wing_name || resolvedWingName || data.location_name || ticket.location_name || null;
        this.selectedTicket = {
          ...this.selectedTicket, ...data,
          wing_name:        wingNameAfterMerge,
          approved_by_name: data.approved_by_name || data.approved_by || ticket.approved_by_name || null,
          approval_status:  data.approval_status  || ticket.approval_status  || null,
          location_name:    data.location_name    || ticket.location_name    || null,
        };
        this.isOwnerOfSelectedTicket = this.selectedTicket.created_by_name === currentUserName;
        this.ChangeDetectorRef.detectChanges();
      },
      error: () => { this.ChangeDetectorRef.detectChanges(); },
    });

    this.loadComments(ticket.ticket_id);
  }

  closeTicketDetails(): void { this.selectedTicket = null; }

  /* Requester reopens their own Resolved/Closed ticket (README §4). */
  reopenTicket(): void {
    if (!this.selectedTicket) return;
    if (!confirm('Reopen this ticket?')) return;
    this.ticketService.update(this.selectedTicket.ticket_id, { status_name: 'Reopened' } as any).subscribe({
      next: () => {
        alert('Ticket reopened.');
        this.selectedTicket.status_name = 'Reopened';
        this.loadTickets();
        this.ChangeDetectorRef.detectChanges();
      },
      error: (err) => { alert(err.message || 'Failed to reopen ticket'); },
    });
  }

  /* ── COMMENTS ── */
  loadComments(ticketId: number): void {
    this.commentService.getComments(ticketId).subscribe({
      next: (comments) => { this.ticketComments = comments; },
      error: () => { this.ticketComments = []; },
    });
  }

  submitComment(): void {
    if (!this.newCommentText.trim() || !this.selectedTicket || this.isSubmittingComment) return;
    this.isSubmittingComment = true; this.commentError = '';
    this.commentService.addComment(this.selectedTicket.ticket_id, this.newCommentText).subscribe({
      next: (res) => { this.ticketComments.push(res.comment); this.newCommentText = ''; this.isSubmittingComment = false; },
      error: (err) => { this.commentError = err.message; this.isSubmittingComment = false; },
    });
  }

  /* ============================================================
     DATA LOADERS
  ============================================================ */
  loadEmails(): void {
    this.userService.getEmails().subscribe({
      next: (data) => { this.allEmails = data.map((u: any) => u.email).filter((e: any) => !!e); },
      error: () => { this.allEmails = []; },
    });
  }

  loadOrganizations(): void {
    this.organizationService.getAllOrganizations().subscribe({
      next: (orgs: Organization[]) => { this.allOrganizationObjects = orgs; },
      error: () => { console.warn('Could not load organizations'); },
    });
  }

  loadAllUsers(): void {
    const canSee = this.isAdmin || this.isSiteManager;  // managers load for the assign dropdown
    if (!canSee) { this.allUsers = []; this.filteredUsers = []; return; }
    this.userService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.allUsers = users;

        // Non-Admin roles: only show users from the same location
        if (!this.isAdmin) {
          const userLocId = this.getCurrentUserLocationId();
          if (userLocId) {
            this.allUsers = users.filter(u =>
              (u as any).location_id === userLocId ||
              (u.locationName && this.locations.find(
                l => l.location_id === userLocId && l.location_name === u.locationName
              ))
            );
          }
        }

        this.applyUserOrgFilter();
        this.loadAssignedUsers();
        this.ChangeDetectorRef.detectChanges();
      },
      error: () => { this.errorMessage = 'Failed to load users.'; this.ChangeDetectorRef.detectChanges(); },
    });
  }

  applyUserOrgFilter(): void {
    if (!this.userOrganization) { this.filteredUsers = [...this.allUsers]; return; }
    const targetLocation = CLIENT_LOCATION_MAP[this.userOrganization];
    this.filteredUsers = this.allUsers.filter((user: User) => {
      if (user.orgName)       { return user.orgName.toLowerCase() === this.userOrganization.toLowerCase(); }
      if (user.locationName && targetLocation) { return user.locationName.toLowerCase() === targetLocation.toLowerCase(); }
      return false;
    });
    this.userPage = 1;
  }

  submitAssign(): void {
    if (this.assignForm.invalid || !this.selectedAssignTicket) { this.assignForm.markAllAsTouched(); alert('Please fill all required fields'); return; }
    const payload = {
      // org_id/location_id are immutable — do NOT send org_name on assign.
      ticket_id:          this.selectedAssignTicket.ticket_id,
      assigned_to:        Number(this.assignForm.value.assignedTo),
      estimated_end_date: this.assignForm.value.estimatedEndDate,
      remark:             this.assignForm.value.remark || '',
    };
    this.ticketService.assignTicket(payload).subscribe({
      next: () => { alert('Ticket Assigned Successfully'); this.showAssignModal = false; this.selectedAssignTicket = null; this.assignForm.reset(); this.loadTickets(); },
      error: (err) => { alert(err.message || 'Failed to assign ticket'); },
    });
  }

  closeAssignModal(): void { this.showAssignModal = false; this.selectedAssignTicket = null; }

  private loadAssignedUsers(): void {
    const targetTeams = ASSIGNED_TO_TEAMS.map((t: string) => t.toLowerCase());
    const userLocId   = this.getCurrentUserLocationId();

    let eligible = this.allUsers.filter(u =>
      targetTeams.includes(u.teamName?.toLowerCase().trim() ?? '')
    );

    // Non-Admin: further restrict assignable users to same location
    if (!this.isAdmin && userLocId) {
      eligible = eligible.filter(u =>
        (u as any).location_id === userLocId ||
        (u.locationName && this.locations.find(
          l => l.location_id === userLocId && l.location_name === u.locationName
        ))
      );
    }

    this.assignedUsers = eligible;
  }

  loadTeams(): void {
    this.teamService.getAllTeams().subscribe({
      next: (data) => { this.teams = data; this.filteredTeams = [...data]; },
      error: () => { this.errorMessage = 'Failed to load teams'; },
    });
  }

  loadLocations(): void {
    this.locationService.getLocations().subscribe({
      next: (data) => { this.locations = data; },
      error: () => { this.errorMessage = 'Failed to load locations'; },
    });
  }

  loadWings(): void {
    this.wingService.getWings().subscribe({
      next: (data) => { this.wings = data; },
      error: () => { this.errorMessage = 'Failed to load wings'; },
    });
  }

  loadClients(): void {
    this.clientService.getAllClients().subscribe({
      next: (data: Client[]) => { this.clients = data; },
      error: () => { this.errorMessage = 'Failed to load clients.'; },
    });
  }

  loadIssues(): void {
    this.http.get<any[]>(`${environment.apiUrl}/issues`).subscribe({
      next: (data: any[]) => { this.allIssues = data; this.setReasons(); },
      error: () => { this.setReasons(); },
    });
  }

  /* ============================================================
     FILTERS
  ============================================================ */
  setDateRange(range: 'thisWeek' | 'lastWeek'): void {
    this.selectedRange = range; this.showCustomDatePicker = false; this.customDateError = '';
    const today = new Date();
    if (range === 'thisWeek') {
      const s = new Date(today); s.setDate(today.getDate() - today.getDay());
      const e = new Date(s); e.setDate(s.getDate() + 6);
      this.startDate = s.toISOString().split('T')[0]; this.endDate = e.toISOString().split('T')[0];
    } else {
      const s = new Date(today); s.setDate(today.getDate() - today.getDay() - 7);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      this.startDate = s.toISOString().split('T')[0]; this.endDate = e.toISOString().split('T')[0];
    }
    this.applyAllFilters(); this.dropdownOpen = false;
  }

  filterAssignUsers(): void {
    const org  = this.assignForm?.value?.orgName || this.assignOrganization;
    const loc  = CLIENT_LOCATION_MAP[org];
    const userLocId = this.getCurrentUserLocationId();

    this.filteredAssignUsers = this.allUsers.filter((u: User) => {
      const validTeam = u.teamName?.toLowerCase() === 'admin' || u.teamName?.toLowerCase() === 'it services';
      if (!validTeam) return false;

      // Non-Admin: restrict assign-to users to same location
      if (!this.isAdmin && userLocId) {
        const uLocId = (u as any).location_id;
        if (uLocId && uLocId !== userLocId) return false;
      }

      if (u.orgName)       { return u.orgName.toLowerCase() === org.toLowerCase(); }
      if (u.locationName && loc) { return u.locationName.toLowerCase() === loc.toLowerCase(); }
      return true;
    });
  }

  openCustomDatePicker(): void { this.showCustomDatePicker = true; this.selectedRange = 'custom'; this.dropdownOpen = false; this.customDateError = ''; }

  applyCustomDateRange(): void {
    this.customDateError = '';
    if (!this.customStartDate || !this.customEndDate) { this.customDateError = 'Please select both From and To dates.'; return; }
    if (new Date(this.customStartDate) > new Date(this.customEndDate)) { this.customDateError = 'From date cannot be after To date.'; return; }
    this.startDate = this.customStartDate; this.endDate = this.customEndDate;
    this.showCustomDatePicker = false; this.applyAllFilters();
  }

  clearCustomDateRange(): void {
    this.customStartDate = ''; this.customEndDate = ''; this.customDateError = '';
    this.showCustomDatePicker = false; this.selectedRange = 'thisWeek'; this.setDateRange('thisWeek');
  }

  applyAllFilters(): void {
    if (!Array.isArray(this.tickets)) { this.tickets = []; }
    this.applyDateFilter();
    this.applyOrganizationFilter();
    this.applyTabFilter();
    this.calculateCounts();
    this.currentPage = 1;
  }

  applyDateFilter(): void {
    if (!Array.isArray(this.tickets)) { this.dateFilteredTickets = []; return; }
    if (this.selectedRange === 'allTime' || !this.startDate || !this.endDate) {
      this.dateFilteredTickets = [...this.tickets]; return;
    }
    const start = new Date(this.startDate).getTime();
    const end   = new Date(this.endDate + 'T23:59:59').getTime();
    this.dateFilteredTickets = this.tickets.filter(t => {
      const c = new Date(t.created_at).getTime();
      return c >= start && c <= end;
    });
  }

  /* applyOrganizationFilter
     Admin         → filter by dashboardOrganization (dropdown controlled)
     IT Services   → already location-filtered in loadTickets; no org re-filter needed
     DBA           → skip; already team+location scoped
     Manager       → skip; already location-scoped from API
     Employee/User → skip; already user-scoped
  ============================================================ */
  applyOrganizationFilter(): void {
    // Non-Admin roles skip org filter — visibility is enforced by location or user scope
    if (!this.isAdmin) return;

    if (!this.dashboardOrganization) return;
    const selectedOrg = this.dashboardOrganization.toLowerCase().trim();
    this.dateFilteredTickets = this.dateFilteredTickets.filter(t => {
      const tOrg = (t.org_name || '').toLowerCase().trim();
      return tOrg === selectedOrg;
    });
  }

  applyTabFilter(): void {
    switch (this.activeTicketTab) {
      case 'wip':    this.filteredTickets = this.dateFilteredTickets.filter(t => t.status_name === 'In Progress'); break;
      case 'open':   this.filteredTickets = this.dateFilteredTickets.filter(t => ['Open', 'Reopened', 'Pending Approval', 'Approved'].includes(t.status_name)); break;
      case 'closed': this.filteredTickets = this.dateFilteredTickets.filter(t => t.status_name === 'Closed' || t.status_name === 'Resolved'); break;
      default:       this.filteredTickets = [...this.dateFilteredTickets];
    }
    this.applySearchFilter();
  }

  private applySearchFilter(): void {
    if (!this.searchTerm.trim()) return;
    const term = this.searchTerm.toLowerCase();
    this.filteredTickets = this.filteredTickets.filter(t =>
      t.ticket_number?.toString().toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.created_by_name?.toLowerCase().includes(term) ||
      t.status_name?.toLowerCase().includes(term) ||
      t.priority?.toLowerCase().includes(term) ||
      t.issue_name?.toLowerCase().includes(term) ||
      t.team_name?.toLowerCase().includes(term) ||
      t.assigned_to_name?.toLowerCase().includes(term)
    );
  }

  onSearch(): void {
    if (this.activeSidebarTab === 'dashboard' || this.activeSidebarTab === 'viewTickets') { this.applyAllFilters(); }
    if (this.activeSidebarTab === 'users')  { this.applyUserSearch(); }
    if (this.activeSidebarTab === 'teams')  { this.applyTeamSearch(); }
  }

  onAssignOrgChange(): void { this.filterAssignUsers(); }

  setAllTime(): void {
    this.selectedRange = 'allTime'; this.startDate = ''; this.endDate = '';
    this.showCustomDatePicker = false; this.customDateError = ''; this.dropdownOpen = false;
    this.applyAllFilters();
  }

  applyTeamSearch(): void {
    if (!this.searchTerm.trim()) { this.filteredTeams = [...this.teams]; return; }
    const term = this.searchTerm.toLowerCase();
    this.filteredTeams = this.teams.filter(t => t.team_name?.toLowerCase().includes(term));
    this.teamPage = 1;
  }

  applyUserSearch(): void {
    const targetLocation   = CLIENT_LOCATION_MAP[this.userOrganization];
    const orgFilteredUsers = this.userOrganization
      ? this.allUsers.filter((u: User) => {
          if (u.orgName)       { return u.orgName.toLowerCase() === this.userOrganization.toLowerCase(); }
          if (u.locationName && targetLocation) { return u.locationName.toLowerCase() === targetLocation.toLowerCase(); }
          return false;
        })
      : [...this.allUsers];
    if (!this.searchTerm.trim()) { this.filteredUsers = orgFilteredUsers; this.userPage = 1; return; }
    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = orgFilteredUsers.filter(u =>
      u.firstName?.toLowerCase().includes(term) ||
      u.lastName?.toLowerCase().includes(term)  ||
      u.email?.toLowerCase().includes(term)     ||
      u.teamName?.toLowerCase().includes(term)
    );
    this.userPage = 1;
  }

  calculateCounts(): void {
    const openish = ['Open', 'Reopened', 'Pending Approval', 'Approved'];
    this.totalRaised   = this.dateFilteredTickets.length;
    this.totalResolved = this.dateFilteredTickets.filter(t => t.status_name === 'Closed' || t.status_name === 'Resolved').length;
    this.totalPaused   = this.dateFilteredTickets.filter(t => t.status_name === 'On Hold').length;   // paused = On Hold
    this.allCount      = this.dateFilteredTickets.length;
    this.wipCount      = this.dateFilteredTickets.filter(t => t.status_name === 'In Progress').length;
    this.openCount     = this.dateFilteredTickets.filter(t => openish.includes(t.status_name)).length;
    this.closedCount   = this.dateFilteredTickets.filter(t => t.status_name === 'Closed' || t.status_name === 'Resolved').length;
  }

  switchTicketTab(tab: 'all' | 'wip' | 'open' | 'closed'): void {
    this.activeTicketTab          = tab;
    this.currentPage              = 1;
    this.dashboardPagination.page = 1;
    this.ticketsPagination.page   = 1;
    this.applyTabFilter();
    this.calculateCounts();
  }

  selectEmail(email: string): void {
    this.ticketForm.patchValue({ additional_email: email });
    this.filteredEmails = []; this.showEmailSuggestions = false;
  }

  selectEmailId(email: string): void {
    const current = this.ticketForm.get('email_id')?.value || '';
    const parts   = current.split(',').map((e: string) => e.trim()).filter((e: string) => !!e);
    if (parts.length > 0) { parts[parts.length - 1] = email; } else { parts.push(email); }
    this.ticketForm.patchValue({ email_id: parts.join(', ') + ', ' });
    this.filteredEmailsForEmailId = []; this.showEmailSuggestionsForEmailId = false;
  }

  /* ============================================================
     PAGINATION
  ============================================================ */
  paginate(list: any[], config: PaginationConfig) {
    config.total       = list.length;
    const start        = (config.page - 1) * config.perPage;
    const end          = start + config.perPage;
    config.showingFrom = list.length === 0 ? 0 : start + 1;
    config.showingTo   = Math.min(end, list.length);
    return list.slice(start, end);
  }

  get pageSize(): number {
    if (this.activeSidebarTab === 'dashboard')     return 6;
    if (this.activeSidebarTab === 'viewTickets')   return 9;
    if (this.activeSidebarTab === 'closedTickets') return 9;
    return 6;
  }

  get totalPages(): number { return Math.ceil(this.filteredTickets.length / this.pageSize); }

  get paginatedTickets() {
    if (this.activeSidebarTab === 'viewTickets') return this.paginate(this.filteredTickets, this.ticketsPagination);
    return this.paginate(this.filteredTickets, this.dashboardPagination);
  }

  get paginatedClosedTickets() { return this.paginate(this.closedTickets, this.closedPagination); }

  get totalClosedTicketPages(): number { return Math.ceil(this.closedTickets.length / this.closedTicketsPerPage); }
  get showingFrom(): number { return (this.currentPage - 1) * this.pageSize + 1; }
  get showingTo():   number { const e = this.currentPage * this.pageSize; return e > this.filteredTickets.length ? this.filteredTickets.length : e; }
  get itemsPerPage() { return this.activeSidebarTab === 'dashboard' ? 6 : 9; }

  get totalUserPages(): number { return Math.ceil(this.filteredUsers.length / this.usersPerPage); }
  get paginatedUsers(): User[] { const s = (this.userPage - 1) * this.usersPerPage; return this.filteredUsers.slice(s, s + this.usersPerPage); }
  nextUserPage()  { if (this.userPage < this.totalUserPages) this.userPage++; }
  prevUserPage()  { if (this.userPage > 1) this.userPage--; }

  get totalTeamPages(): number { return Math.ceil(this.filteredTeams.length / this.teamsPerPage); }
  get paginatedTeams(): Team[] { const s = (this.teamPage - 1) * this.teamsPerPage; return this.filteredTeams.slice(s, s + this.teamsPerPage); }
  nextTeamPage()  { if (this.teamPage < this.totalTeamPages) this.teamPage++; }
  prevTeamPage()  { if (this.teamPage > 1) this.teamPage--; }

  nextClosedTicketPage()  { if (this.closedTicketPage < this.totalClosedTicketPages) this.closedTicketPage++; }
  prevClosedTicketPage()  { if (this.closedTicketPage > 1) this.closedTicketPage--; }

  nextPage(config: PaginationConfig)     { const t = Math.ceil(config.total / config.perPage); if (config.page < t) config.page++; }
  previousPage(config: PaginationConfig) { if (config.page > 1) config.page--; }

  onEntriesChange(): void {
    const v = Number(this.selectedEntries);
    this.dashboardPagination.page = 1; this.dashboardPagination.perPage = v;
    this.ticketsPagination.page   = 1; this.ticketsPagination.perPage   = v;
    this.closedPagination.page    = 1; this.closedPagination.perPage    = v;
  }

  /* ============================================================
     UI HELPERS
  ============================================================ */
  switchDashboardView(view: 'cards' | 'list'): void    { this.dashboardView       = view; }
  switchTicketsView(view: 'cards' | 'list'): void      { this.ticketsView         = view; }
  switchClosedTicketsView(view: 'cards' | 'list'): void { this.closedTicketsView  = view; }
  goToDashboard(): void { this.activeSidebarTab = 'dashboard'; this.showNewTicketForm = false; this.selectedTicket = null; }

  /* onChange — Admin switches org dropdown.
     Re-filters from allTickets cache (no HTTP call).
     Non-Admin roles: org dropdown is hidden; this fires only for Admin. */
  onChange(org: string): void {
    this.dashboardOrganization    = org;
    this.userOrganization         = org;
    this.assignOrganization       = org;
    this.dashboardPagination.page = 1;
    this.ticketsPagination.page   = 1;
    this.closedPagination.page    = 1;

    if (this.allTickets.length > 0) {
      // Admin: re-filter from full in-memory cache — no new HTTP call needed
      this.tickets = [...this.allTickets];
      this.applyAllFilters();

      const closedStatuses = ['closed', 'resolved'];
      const selectedOrg    = org.toLowerCase().trim();
      this.closedTickets          = this.allTickets.filter(t =>
        closedStatuses.includes((t.status_name || '').toLowerCase()) &&
        (t.org_name || '').toLowerCase().trim() === selectedOrg
      );
      this.closedPagination.total = this.closedTickets.length;
    } else {
      this.loadTickets();
      this.loadClosedTickets();
    }

    const canSeeUsers = this.isAdmin || this.isITService || this.isDBA || this.isSiteManager;
    if (canSeeUsers && this.allUsers.length > 0) { this.applyUserOrgFilter(); }
  }

  backToTicketTab()  { this.showNewTicketForm = false; this.editingTicket = null; }
  toggleDropdown()   { this.dropdownOpen = !this.dropdownOpen; }
  toggleTicketMenu() { this.showTicketMenu = !this.showTicketMenu; }
  toggleUserDropdown(event: Event): void { event.stopPropagation(); this.showDropdown = !this.showDropdown; }

  logout(event: Event): void { event.stopPropagation(); this.authService.logout(); this.router.navigateByUrl('/login'); }

  onFileChange(event: any): void { if (event.target.files?.length > 0) { this.selectedFile = event.target.files[0]; } }

  viewAttachment(fileName: string | null): void {
    if (!fileName) return;
    this.currentAttachmentUrl = this.getAttachmentUrl(fileName);
    this.showAttachmentModal  = true;
  }

  closeAttachmentModal(): void { this.showAttachmentModal = false; this.currentAttachmentUrl = null; }

  getAttachmentUrl(fileName: string): string {
    if (!fileName) return '';
    if (fileName.startsWith('http'))     return fileName;
    if (fileName.startsWith('/uploads')) return `http://localhost:5000${fileName}`;
    return `http://localhost:5000/uploads/${fileName}`;
  }

  getAttachmentFileName(url: string): string { if (!url) return ''; return url.split('/').pop() || ''; }

  getCurrentUser(): User | null { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }

  getStatusDotClass(ticket: MyTicket): string {
    return ticket.priority === 'High' ? 'status-dot-high' : ticket.priority === 'Medium' ? 'status-dot-medium' : 'status-dot-low';
  }

  getPriorityBadgeClass(ticket: MyTicket): string {
    return ticket.priority === 'High' ? 'priority-high' : ticket.priority === 'Medium' ? 'priority-medium' : 'priority-low';
  }

  getBorderClass(ticket: MyTicket): string { return this.getPriorityBadgeClass(ticket).replace('priority', 'border'); }

  trackByTeam(index: number, team: Team)         { return team.team_id; }
  trackByTicket(index: number, ticket: MyTicket) { return ticket.ticket_id; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.date-dropdown'))          { this.dropdownOpen = false; this.showCustomDatePicker = false; }
    if (!target.closest('.user-dropdown'))          { this.showDropdown = false; }
    if (!target.closest('.email-id-field'))         { this.filteredEmailsForEmailId = []; this.showEmailSuggestionsForEmailId = false; }
    if (!target.closest('.additional-email-field')) { this.filteredEmails = []; this.showEmailSuggestions = false; }
    if (!target.closest('.notification-dropdown'))  { this.showNotificationDropdown = false; }
  }

  get filteredWings(): Wing[] {
    const org = (this.currentUser?.orgName || '').toLowerCase().trim();
    if (org.includes('hansa direct')) {
      return this.wings.filter(w => ['A','B','C','D'].includes(w.wing_name.trim().toUpperCase()));
    }
    return this.wings;
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}