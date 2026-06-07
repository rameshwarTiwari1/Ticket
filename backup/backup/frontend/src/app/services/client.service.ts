import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Client,
  ClientResponse,
  CreateClientPayload,
  UpdateClientPayload,
  ResolveClientPayload,
  ResolveClientResponse,
  DeleteClientResponse,
} from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private apiUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /* ================= GET ALL CLIENTS ================= */
  // Use this to populate dropdowns — returns [{ client_id, client_name }]
  getAllClients(): Observable<Client[]> {
    return this.http.get<Client[]>(this.apiUrl, {
      headers: this.getHeaders(),
    });
  }

  /* ================= GET CLIENT BY ID ================= */
  getClientById(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders(),
    });
  }

  /* ================= RESOLVE NAME → ID ================= */
  // Call before creating a ticket:
  // Send { client_name: 'Hdfc' } → get back { client_id: 1, client_name: 'Hdfc' }
  resolveClientId(payload: ResolveClientPayload): Observable<ResolveClientResponse> {
    return this.http.post<ResolveClientResponse>(
      `${this.apiUrl}/resolve`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /* ================= CREATE CLIENT ================= */
  createClient(payload: CreateClientPayload): Observable<ClientResponse> {
    return this.http.post<ClientResponse>(this.apiUrl, payload, {
      headers: this.getHeaders(),
    });
  }

  /* ================= UPDATE CLIENT ================= */
  updateClient(id: number, payload: UpdateClientPayload): Observable<ClientResponse> {
    return this.http.put<ClientResponse>(`${this.apiUrl}/${id}`, payload, {
      headers: this.getHeaders(),
    });
  }

  /* ================= DELETE CLIENT ================= */
  deleteClient(id: number): Observable<DeleteClientResponse> {
    return this.http.delete<DeleteClientResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders(),
    });
  }
}