import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppNotification } from '../models/Models';
import { environment } from '../environments/environment';

// In-app notifications (README §10). Token attached by AuthInterceptor.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private apiUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  list(unreadOnly = false): Observable<AppNotification[]> {
    const qs = unreadOnly ? '?unread=true' : '';
    return this.http.get<AppNotification[]>(`${this.apiUrl}${qs}`);
  }

  markRead(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/read-all`, {});
  }
}
