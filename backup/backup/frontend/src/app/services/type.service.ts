import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Type, CreateTypePayload } from '../models/Models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class TypeService {
  private apiUrl = `${environment.apiUrl}/types`;

  constructor(private http: HttpClient) {}

  // GET all types
  getAll(): Observable<Type[]> {
    return this.http.get<Type[]>(this.apiUrl);
  }

  // GET type by ID
  getById(id: number): Observable<Type> {
    return this.http.get<Type>(`${this.apiUrl}/${id}`);
  }

  // CREATE type
  create(payload: CreateTypePayload): Observable<Type> {
    return this.http.post<Type>(this.apiUrl, payload);
  }

  // UPDATE type
  update(id: number, payload: CreateTypePayload): Observable<Type> {
    return this.http.put<Type>(`${this.apiUrl}/${id}`, payload);
  }

  // DELETE type
  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}