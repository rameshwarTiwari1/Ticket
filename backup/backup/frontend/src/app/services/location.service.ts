import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '../models/Models';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private baseUrl = `${environment.apiUrl}/locations`;
  constructor(private http: HttpClient) {}
  
  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(this.baseUrl);
  }

  getLocation(id: number): Observable<Location> {
    return this.http.get<Location>(`${this.baseUrl}/${id}`);
  }

  createLocation(location: Location): Observable<Location> {
    return this.http.post<Location>(this.baseUrl, location);
  }

  updateLocation(id: number, location: Location): Observable<Location> {
    return this.http.put<Location>(`${this.baseUrl}/${id}`, location);
  }

  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}