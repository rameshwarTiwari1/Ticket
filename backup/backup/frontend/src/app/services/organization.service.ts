// src/app/services/organization.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Organization } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly baseUrl = `${environment.apiUrl}/organizations`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Public — no token (registration page) ────────────────────────────────
  getAllPublic(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.baseUrl}/public`);
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  getAllOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.baseUrl, {
      headers: this.getHeaders(),
    });
  }

  getOrganizationById(id: number): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/${id}`, {
      headers: this.getHeaders(),
    });
  }

  getOrganizationByName(name: string): Observable<Organization> {
    return this.http.get<Organization>(
      `${this.baseUrl}/by-name/${encodeURIComponent(name)}`,
      { headers: this.getHeaders() }
    );
  }

  createOrganization(payload: { org_name: string; location_id: number }): Observable<any> {
    return this.http.post(this.baseUrl, payload, { headers: this.getHeaders() });
  }

  updateOrganization(id: number, payload: Partial<{ org_name: string; location_id: number }>): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, payload, { headers: this.getHeaders() });
  }

  deleteOrganization(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`, { headers: this.getHeaders() });
  }
}