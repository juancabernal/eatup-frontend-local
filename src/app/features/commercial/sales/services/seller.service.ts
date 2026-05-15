import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class SellerService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace(/\/api\/v1\/?$/, '');
  private readonly candidates = [
    `${this.apiRoot}/commercial/api/v1/sellers`,
    `${this.apiRoot}/commercial/sellers`,
    `${this.apiRoot}/api/v1/sellers`,
    `${this.apiRoot}/sellers`
  ];

  getSellers(): Observable<Seller[]> {
    return this.tryEndpoint(0);
  }

  private tryEndpoint(index: number): Observable<Seller[]> {
    if (index >= this.candidates.length) {
      return throwError(() => new Error('No seller endpoint available'));
    }

    return this.http.get<Seller[]>(this.candidates[index]).pipe(
      catchError(() => this.tryEndpoint(index + 1))
    );
  }
}
