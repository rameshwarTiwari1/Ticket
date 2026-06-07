import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TicketStatus, CreateTicketStatusPayload } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class TicketStatusService {
  private apiUrl = `${environment.apiUrl}/ticket-status`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TicketStatus[]> {
    return this.http.get<TicketStatus[]>(this.apiUrl);
  }

  getById(id: number): Observable<TicketStatus> {
    return this.http.get<TicketStatus>(`${this.apiUrl}/${id}`);
  }

  create(payload: CreateTicketStatusPayload): Observable<TicketStatus> {
    return this.http.post<TicketStatus>(this.apiUrl, payload);
  }

  update(id: number, payload: CreateTicketStatusPayload): Observable<TicketStatus> {
    return this.http.put<TicketStatus>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}