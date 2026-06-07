import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Issue, CreateIssuePayload } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private apiUrl = `${environment.apiUrl}/issues`;

  constructor(private http: HttpClient) {}

  // GET all issues
  getAll(): Observable<Issue[]> {
    return this.http.get<Issue[]>(this.apiUrl);
  }

  // GET issue by ID
  getById(id: number): Observable<Issue> {
    return this.http.get<Issue>(`${this.apiUrl}/${id}`);
  }

  // CREATE issue
  create(payload: CreateIssuePayload): Observable<Issue> {
    return this.http.post<Issue>(this.apiUrl, payload);
  }

  // UPDATE issue
  update(id: number, payload: CreateIssuePayload): Observable<Issue> {
    return this.http.put<Issue>(`${this.apiUrl}/${id}`, payload);
  }

  // DELETE issue
  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}