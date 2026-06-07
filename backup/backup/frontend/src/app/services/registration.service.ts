import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Location, Wing } from '../models/Models';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private authUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  sendOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/send-otp`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/verify-otp`, { email, otp });
  }

  registerUser(payload: any): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/register`, payload);
  }

  resetPassword(email: string, otp: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/reset-password`, {
      email,
      otp,
      newPassword
    });
  }

  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(`${environment.apiUrl}/locations`);
  }

  getWings(): Observable<Wing[]> {
    return this.http.get<Wing[]>(`${environment.apiUrl}/wings`);
  }
}