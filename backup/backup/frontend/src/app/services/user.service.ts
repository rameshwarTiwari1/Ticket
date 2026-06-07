import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { User, CreateUserPayload, LoginPayload, LoginResponse } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /* ================= LOGIN ================= */
  login(payload: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          return throwError(() => ({
            message: err.error?.message || 'Invalid email or password',
            redirectToRegister: err.error?.message?.includes('not exist') || false
          }));
        }
        return throwError(() => ({
          message: 'Login failed. Please try again.'
        }));
      })
    );
  }

  /* ================= VALIDATE TOKEN ================= */
  validateToken(): Observable<{ valid: boolean; user: User }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<{ valid: boolean; user: User }>(`${this.apiUrl}/validate`, { headers });
  }

  /* ================= GET ALL USERS ================= */
  getAllUsers(): Observable<User[]> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<User[]>(this.apiUrl, { headers });
  }

  /* ================= GET USER BY ID ================= */
  getUserById(id: number): Observable<User> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<User>(`${this.apiUrl}/${id}`, { headers });
  }

  /* ================= CREATE USER ================= */
  createUser(payload: CreateUserPayload): Observable<{ message: string; user: User }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ message: string; user: User }>(this.apiUrl, payload, { headers });
  }

  /* ================= UPDATE USER ================= */
  updateUser(id: number, payload: CreateUserPayload): Observable<{ message: string; user: User }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.put<{ message: string; user: User }>(`${this.apiUrl}/${id}`, payload, { headers });
  }

  /* ================= DELETE USER ================= */
  deleteUser(userId: number, newUserId?: number): Observable<{ message: string }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${userId}`, {
      headers,
      body: { newUserId }
    });
  }

  /* ================= REASSIGN TICKETS ================= */
  reassignTickets(oldUserId: number, newUserId: number): Observable<{ message: string }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/reassign`,
      { oldUserId, newUserId },
      { headers }
    );
  }
  /* ================= GET EMAILS (all authenticated users) ================= */
getEmails(): Observable<{ email: string }[]> {
  const token = localStorage.getItem('token') || '';
  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
  return this.http.get<{ email: string }[]>(`${this.apiUrl}/emails`, { headers }).pipe(
    catchError(() => throwError(() => ({ message: 'Failed to fetch emails' })))
  );
}

  /* ================= SET ROLE (Admin) ================= */
  // Promote/demote a user: 'admin' | 'manager' | 'employee' | 'user'.
  setRole(userId: number, role: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${userId}/role`, { role });
  }

  /* ================= TRANSFER LOCATION (Admin) ================= */
  transferLocation(userId: number, location_id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${userId}/transfer`, { location_id });
  }

  /* ================= ASSIGNABLE USERS (Manager/Admin) ================= */
  // Employees a Manager may assign to (own team+location). Admin passes ids.
  getAssignableUsers(teamId?: number, locationId?: number): Observable<User[]> {
    let url = `${this.apiUrl}/assignable`;
    if (teamId && locationId) url += `?team_id=${teamId}&location_id=${locationId}`;
    return this.http.get<User[]>(url);
  }
}