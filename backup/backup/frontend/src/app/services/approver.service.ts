import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Approver } from '../models/Models';
import { environment } from '../environments/environment';

// Admin-managed approver registry (README §6). Token is attached by AuthInterceptor.
@Injectable({ providedIn: 'root' })
export class ApproverService {
  private apiUrl = `${environment.apiUrl}/approvers`;

  constructor(private http: HttpClient) {}

  // Approver choices for the ticket form, filtered to a location (any user).
  options(locationId?: number): Observable<Approver[]> {
    const qs = locationId ? `?location_id=${locationId}` : '';
    return this.http.get<Approver[]>(`${this.apiUrl}/options${qs}`);
  }

  list(filters?: { org_id?: number; location_id?: number }): Observable<Approver[]> {
    const params: string[] = [];
    if (filters?.org_id)      params.push(`org_id=${filters.org_id}`);
    if (filters?.location_id) params.push(`location_id=${filters.location_id}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<Approver[]>(`${this.apiUrl}${qs}`);
  }

  create(payload: Approver): Observable<{ message: string; approver: Approver }> {
    return this.http.post<{ message: string; approver: Approver }>(this.apiUrl, payload);
  }

  update(id: number, payload: Partial<Approver>): Observable<{ message: string; approver: Approver }> {
    return this.http.put<{ message: string; approver: Approver }>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
