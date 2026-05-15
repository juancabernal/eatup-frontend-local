import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ENV } from '@config/env.config';

export interface Seller {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  document?: string;
  status?: string;
  active?: boolean;
}

interface SellerApiResponse {
  content?: unknown;
  data?: unknown;
  sellers?: unknown;
}

@Injectable({ providedIn: 'root' })
export class SellerService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace(/\/api\/v1\/?$/, '');
  // Use the sellers endpoint exposed by the backend controller
  // Note: backend controller maps to /comercialapi/v1/sellers
  private readonly baseUrl = `${this.apiRoot}/comercialapi/v1/sellers`;

  getSellers(): Observable<Seller[]> {
    return this.http
      .get<Seller[] | SellerApiResponse>(this.baseUrl)
      .pipe(map(response => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: Seller[] | SellerApiResponse): Seller[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && Array.isArray(response.content)) {
      return response.content as Seller[];
    }

    if (response && Array.isArray(response.data)) {
      return response.data as Seller[];
    }

    if (response && Array.isArray(response.sellers)) {
      return response.sellers as Seller[];
    }

    return [];
  }
}
