import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { EnvironmentService } from '../../../../core/services/environment.service';
import { LocationOption, RestaurantTable, Seller } from '../models/sales.model';

type LookupStatus = 'idle' | 'success' | 'empty' | 'failed';

@Injectable({ providedIn: 'root' })
export class SellerTableService {
  private readonly apiRoot: string;
  detectedSellersEndpoint = '';
  detectedTablesEndpoint = '';
  sellersLookupStatus: LookupStatus = 'idle';
  tablesLookupStatus: LookupStatus = 'idle';

  constructor(private readonly http: HttpClient, private readonly env: EnvironmentService) {
    this.apiRoot = this.env.apiUrl.replace(/\/api\/v1\/?$/, '');
  }

  getSellers(): Observable<Seller[]> {
    const locationId = this.env.locationId;
    const locationParam = locationId ? `&locationId=${encodeURIComponent(locationId)}` : '';
    const endpoints = [
      `${this.apiRoot}/comercialapi/v1/sellers?status=ACTIVE${locationParam}`,
      `${this.apiRoot}/comercialapi/v1/sellers${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`,
      `${this.env.apiUrl}/sellers`
    ];

    this.detectedSellersEndpoint = '';
    this.sellersLookupStatus = 'idle';
    return this.tryEndpoints<Seller>(endpoints, 'seller');
  }


  getLocations(): Observable<LocationOption[]> {
    const endpoints = [
      `${this.apiRoot}/inventory/api/v1/location/active`,
      `${this.apiRoot}/inventory/api/v1/location`
    ];

    return this.tryLocationEndpoints(endpoints);
  }

  getTables(): Observable<RestaurantTable[]> {
    const locationId = this.env.locationId;
    const encodedLocationId = encodeURIComponent(locationId);
    const endpoints = locationId
      ? [
          `${this.apiRoot}/commercial/api/v1/tables?canOpenNow=true&locationId=${encodedLocationId}`,
          `${this.apiRoot}/commercial/api/v1/tables?locationId=${encodedLocationId}`,
          `${this.apiRoot}/commercial/api/v1/tables?canOpenNow=true&venueId=${encodedLocationId}`,
          `${this.apiRoot}/commercial/api/v1/tables?venueId=${encodedLocationId}`,
          `${this.apiRoot}/commercial/api/v1/tables?canOpenNow=true`,
          `${this.apiRoot}/commercial/api/v1/tables`,
          `${this.apiRoot}/commercial/api/v1/restaurant-tables`,
          `${this.apiRoot}/commercial/api/v1/table-sessions`,
          `${this.env.apiUrl}/restaurant-tables`,
          `${this.env.apiUrl}/table-sessions`
        ]
      : [
          `${this.apiRoot}/commercial/api/v1/tables?canOpenNow=true`,
          `${this.apiRoot}/commercial/api/v1/tables`,
          `${this.apiRoot}/commercial/api/v1/restaurant-tables`,
          `${this.apiRoot}/commercial/api/v1/table-sessions`,
          `${this.env.apiUrl}/restaurant-tables`,
          `${this.env.apiUrl}/table-sessions`
        ];

    this.detectedTablesEndpoint = '';
    this.tablesLookupStatus = 'idle';
    return this.tryEndpoints<RestaurantTable>(endpoints, 'table');
  }


  private tryLocationEndpoints(endpoints: string[], idx = 0): Observable<LocationOption[]> {
    if (idx >= endpoints.length) {
      return of([]);
    }

    return this.http.get<unknown>(endpoints[idx]).pipe(
      switchMap(response => {
        const locations = this.normalize<LocationOption>(response)
          .filter(location => !!location.id && !!location.name)
          .map(location => ({
            id: location.id,
            name: location.name,
            active: location.active
          }));

        if (locations.length > 0) {
          return of(locations);
        }

        return this.tryLocationEndpoints(endpoints, idx + 1);
      }),
      catchError(() => this.tryLocationEndpoints(endpoints, idx + 1))
    );
  }

  private tryEndpoints<T>(
    endpoints: string[],
    type: 'seller' | 'table',
    idx = 0,
    sawEmptyResponse = false
  ): Observable<T[]> {
    if (idx >= endpoints.length) {
      this.setLookupStatus(type, sawEmptyResponse ? 'empty' : 'failed');
      return of([]);
    }

    const endpoint = endpoints[idx];

    return this.http.get<unknown>(endpoint).pipe(
      switchMap(response => {
        const items = this.normalize<T>(response);

        if (items.length > 0) {
          this.setDetectedEndpoint(type, endpoint);
          this.setLookupStatus(type, 'success');
          return of(items);
        }

        return this.tryEndpoints<T>(endpoints, type, idx + 1, true);
      }),
      catchError(() => this.tryEndpoints<T>(endpoints, type, idx + 1, sawEmptyResponse))
    );
  }

  private setDetectedEndpoint(type: 'seller' | 'table', endpoint: string): void {
    if (type === 'seller') {
      this.detectedSellersEndpoint = endpoint;
    } else {
      this.detectedTablesEndpoint = endpoint;
    }
  }

  private setLookupStatus(type: 'seller' | 'table', status: LookupStatus): void {
    if (type === 'seller') {
      this.sellersLookupStatus = status;
    } else {
      this.tablesLookupStatus = status;
    }
  }

  private normalize<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    const response = value as Record<string, unknown> | null | undefined;

    if (!response) {
      return [];
    }

    return (
      response['content'] ??
      response['data'] ??
      response['sellers'] ??
      response['locations'] ??
      response['tables'] ??
      response['sessions'] ??
      response['items'] ??
      []
    ) as T[];
  }
}
