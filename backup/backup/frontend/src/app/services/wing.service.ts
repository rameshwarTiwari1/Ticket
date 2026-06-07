import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Wing } from '../models/Models';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WingService {
private readonly api = `${environment.apiUrl}/wings`;
  constructor(private http: HttpClient) {}

  getWings(): Observable<Wing[]> {
    return this.http.get<Wing[]>(this.api);
  }

  getWing(id: number): Observable<Wing> {
    return this.http.get<Wing>(`${this.api}/${id}`);
  }

  createWing(wing: Wing): Observable<Wing> {
    return this.http.post<Wing>(this.api, wing);
  }

  updateWing(id: number, wing: Wing): Observable<Wing> {
    return this.http.put<Wing>(`${this.api}/${id}`, wing);
  }

  deleteWing(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }
}