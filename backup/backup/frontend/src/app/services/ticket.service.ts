import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GenerateTicket, MyTicket, UpdateTicket } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly api = `${environment.apiUrl}/tickets-generate`;

  private searchSubject = new BehaviorSubject<string>('');
  search$ = this.searchSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  create(ticket: GenerateTicket): Observable<MyTicket> {
    const formData = this.buildFormData(ticket);
    console.log('API URL:', this.api);
    console.log('Form Data:', formData);
    console.log([...formData.entries()]);
    return this.http.post<MyTicket>(this.api, formData).pipe(
      catchError(err =>
        throwError(() => new Error(err.error?.message || 'Failed to create ticket'))
      )
    );
  }

  // ── GET ALL (Admin / IT Services)
  // FIX: Do NOT send org_id — Admin must see ALL orgs, then filter client-side.
  // The org dropdown on the dashboard handles filtering after load.
  getAll(orgId?: number): Observable<MyTicket[]> {
    // Intentionally ignore orgId so Admin sees every ticket across all orgs.
    // Client-side applyOrganizationFilter() handles the dropdown selection.
    return this.http.get<MyTicket[]>(this.api, {
      headers: this.getAuthHeaders(),
    }).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(err => {
        console.error('GET TICKETS ERROR:', err);
        return throwError(() =>
          new Error(err.error?.message || err.message || 'Failed to fetch tickets')
        );
      })
    );
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  getById(id: number): Observable<MyTicket> {
    return this.http.get<MyTicket>(`${this.api}/${id}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(err => throwError(() => new Error('Ticket not found')))
    );
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  update(id: number, ticket: UpdateTicket): Observable<MyTicket> {
    const formData = this.buildFormData(ticket);
    const token = localStorage.getItem('token') || '';
    return this.http.put<MyTicket>(`${this.api}/${id}`, formData, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
    }).pipe(
      catchError(err => throwError(() => new Error('Failed to update ticket')))
    );
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  deleteTicket(ticketId: number): Observable<any> {
    return this.http.delete(`${this.api}/${ticketId}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(err => throwError(() => new Error('Failed to delete ticket')))
    );
  }

  // ── GET MY TICKETS (own tickets — regular users) ───────────────────────────
  getMyTickets(userId: number): Observable<MyTicket[]> {
    return this.http.get<MyTicket[]>(`${this.api}/user/${userId}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(err => throwError(() => new Error('Unable to fetch tickets')))
    );
  }

  // ── GET TICKETS BY USER ───────────────────────────────────────────────────
  getTicketsByUser(userId: number): Observable<MyTicket[]> {
    return this.http.get<MyTicket[]>(`${this.api}/user/${userId}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(err => throwError(() => new Error('Unable to fetch user tickets')))
    );
  }

  // ── GET TICKETS BY ASSIGNED TEAM (DBA branch) ─────────────────────────────
  // FIX: The backend /assigned-team/:team route may not exist yet.
  // We fetch ALL tickets and filter client-side as a safe fallback.
  // When the backend route is ready, swap the implementation to use the
  // dedicated endpoint and remove the client-side filter.
  getTicketsByAssignedTeam(teamName: string): Observable<MyTicket[]> {
    // Try the dedicated endpoint first
    return this.http.get<MyTicket[]>(
      `${this.api}/assigned-team/${encodeURIComponent(teamName)}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(err => {
        // Backend route not implemented (404/500) — fall back to getAll + filter
        console.warn(
          `[TicketService] /assigned-team/${teamName} failed (${err.status ?? err.message}). ` +
          `Falling back to getAll() + client-side filter.`
        );
        return this.http.get<MyTicket[]>(this.api, {
          headers: this.getAuthHeaders(),
        }).pipe(
          map(allTickets => {
            const safe = Array.isArray(allTickets) ? allTickets : [];
            return safe.filter(t =>
              (t.assigned_to_name || '').toLowerCase().includes(teamName.toLowerCase()) ||
              (t.team_name || '').toLowerCase() === teamName.toLowerCase()
            );
          }),
          catchError(err2 =>
            throwError(() => new Error(err2.error?.message || 'Failed to fetch team tickets'))
          )
        );
      })
    );
  }

  // ── GET TICKETS BY LOCATION (Manager branch) ──────────────────────────────
  // Backend endpoint: GET /tickets-generate/location/:locationId
  // Falls back to getAll() + client-side filter if route not yet available.
  getTicketsByLocation(locationId: number): Observable<MyTicket[]> {
    return this.http.get<MyTicket[]>(
      `${this.api}/location/${locationId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(err => {
        console.warn(
          `[TicketService] /location/${locationId} failed (${err.status ?? err.message}). ` +
          `Falling back to getAll() + client-side filter.`
        );
        return this.http.get<MyTicket[]>(this.api, {
          headers: this.getAuthHeaders(),
        }).pipe(
          map(allTickets => {
            const safe = Array.isArray(allTickets) ? allTickets : [];
            return safe.filter(t => {
              const locId = (t as any).created_at_location_id ?? (t as any).location_id;
              return locId === locationId;
            });
          }),
          catchError(err2 =>
            throwError(() => new Error(err2.error?.message || 'Failed to fetch location tickets'))
          )
        );
      })
    );
  }

  // ── ASSIGN TICKET ─────────────────────────────────────────────────────────
  assignTicket(payload: any): Observable<any> {
    return this.http.post(`${this.api}/assign-ticket`, payload, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(err =>
        throwError(() => new Error(err.error?.message || 'Failed to assign ticket'))
      )
    );
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  setSearchTerm(term: string): void {
    this.searchSubject.next(term);
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────
  private buildFormData(data: any): FormData {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== undefined && value !== null) {
        if (value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, value.toString());
        }
      }
    });
    return formData;
  }
}