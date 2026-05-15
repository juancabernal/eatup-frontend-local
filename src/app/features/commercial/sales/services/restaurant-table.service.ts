import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ENV } from '@config/env.config';

export interface RestaurantTable {
  id: string;
  name?: string;
  number?: string | number;
  code?: string;
  displayName?: string;
  status?: string;
  available?: boolean;
  occupied?: boolean;
  active?: boolean;
  locationId?: string;
}

interface TableApiResponse {
  content?: unknown;
  data?: unknown;
  tables?: unknown;
}

@Injectable({ providedIn: 'root' })
export class RestaurantTableService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace(/\/api\/v1\/?$/, '');
  private readonly baseUrl = `${this.apiRoot}/commercial/api/v1/restaurant-tables`;

  getTables(): Observable<RestaurantTable[]> {
    return this.http
      .get<RestaurantTable[] | TableApiResponse>(this.baseUrl)
      .pipe(map(response => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: RestaurantTable[] | TableApiResponse): RestaurantTable[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && Array.isArray(response.content)) {
      return response.content as RestaurantTable[];
    }

    if (response && Array.isArray(response.data)) {
      return response.data as RestaurantTable[];
    }

    if (response && Array.isArray(response.tables)) {
      return response.tables as RestaurantTable[];
    }

    return [];
  }
}
