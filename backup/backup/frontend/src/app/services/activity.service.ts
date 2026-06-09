import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  activity_type: string;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  ticket_id: number | null;
  created_at: string;
}

// Activity logs (Phase-2). Token attached by AuthInterceptor.
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private apiUrl = `${environment.apiUrl}/activity-logs`;
  constructor(private http: HttpClient) {}

  list(type?: string): Observable<ActivityLog[]> {
    const qs = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.http.get<ActivityLog[]>(`${this.apiUrl}${qs}`);
  }
}
