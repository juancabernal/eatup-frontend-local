import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENV } from '@config/env.config';

export interface RestaurantTable {
  id: string;
  name?: string;
  number?: string;
  code?: string;
  status?: string;
  available?: boolean;
  occupied?: boolean;
  locationId?: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantTableService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace(/\/api\/v1\/?$/, '');
  private readonly baseUrl = `${this.apiRoot}/commercial/api/v1/restaurant-tables`;

  getTables(): Observable<RestaurantTable[]> {
    return this.http.get<RestaurantTable[]>(this.baseUrl);
  }
}
