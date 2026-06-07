// src/app/services/team.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Team } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private apiUrl = `${environment.apiUrl}/teams`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Public — no token (registration page) ────────────────────────────────
  getAllTeamsPublic(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.apiUrl}/public`);
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  getAllTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(this.apiUrl, {
      headers: this.getAuthHeaders(),
    });
  }

  getTeamById(id: number): Observable<Team> {
    return this.http.get<Team>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  createTeam(team: Partial<Team>): Observable<Team> {
    return this.http.post<Team>(this.apiUrl, team, {
      headers: this.getAuthHeaders(),
    });
  }

  updateTeam(id: number, team: Partial<Team>): Observable<Team> {
    return this.http.put<Team>(`${this.apiUrl}/${id}`, team, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteTeam(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }
}