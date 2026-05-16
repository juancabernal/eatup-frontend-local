import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvironmentService } from '@core/services/environment.service';
import { Observable, map } from 'rxjs';
import { LocationRequest, LocationResponse, LocationPatchRequest } from '../models/location.model';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly apiRoot: string;
  private readonly baseUrl: string;

  constructor(private readonly http: HttpClient, private readonly env: EnvironmentService) {
    this.apiRoot = this.env.apiUrl.replace(/\/api\/v1\/?$/, '');
    this.baseUrl = `${this.apiRoot}/inventory/api/v1/location`;
  }

  getLocations(): Observable<LocationResponse[]> {
    return this.http.get<unknown>(this.baseUrl).pipe(map(v => this.normalize<LocationResponse>(v)));
  }

  getActiveLocations(): Observable<LocationResponse[]> {
    return this.http.get<unknown>(`${this.baseUrl}/active`).pipe(map(v => this.normalize<LocationResponse>(v)));
  }

  getLocationById(id: string): Observable<LocationResponse> {
    return this.http.get<LocationResponse>(`${this.baseUrl}/${id}`);
  }

  createLocation(payload: LocationRequest): Observable<unknown> {
    return this.http.post<unknown>(this.baseUrl, payload);
  }

  updateLocation(id: string, payload: LocationRequest): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/${id}`, payload);
  }

  patchLocation(id: string, patch: LocationPatchRequest): Observable<unknown> {
    return this.http.patch<unknown>(`${this.baseUrl}/editar/${id}`, patch);
  }

  private normalize<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') {
      const maybe = value as Record<string, unknown>;
      if (Array.isArray(maybe['content'])) return maybe['content'] as T[];
      if (Array.isArray(maybe['data'])) return maybe['data'] as T[];
    }
    return [];
  }
}
