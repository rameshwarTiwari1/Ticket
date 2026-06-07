import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { TicketComment } from '../models/Models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly api = `${environment.apiUrl}/tickets-generate`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getComments(ticketId: number): Observable<TicketComment[]> {
    return this.http.get<TicketComment[]>(
      `${this.api}/${ticketId}/comments`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => throwError(() => new Error('Failed to load comments')))
    );
  }

  addComment(ticketId: number, commentText: string): Observable<{ message: string; comment: TicketComment }> {
    return this.http.post<{ message: string; comment: TicketComment }>(
      `${this.api}/${ticketId}/comments`,
      { comment_text: commentText },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => throwError(() => new Error(err.error?.message || 'Failed to add comment')))
    );
  }
}