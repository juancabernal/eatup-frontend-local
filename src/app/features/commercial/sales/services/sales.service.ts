import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ENV } from '@config/env.config';
import {
  RecipePreparationTrace,
  SaleAsyncResponse,
  SaleRequest,
  SaleResponse,
  SaleStatus
} from '@commercial/sales/models/sale.model';

interface PagedSalesResponse {
  content?: SaleResponse[];
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace(/\/api\/v1\/?$/, '');
  private readonly baseUrl = `${this.apiRoot}/commercial/api/v1/sales`;

  getSales(): Observable<SaleResponse[]> {
    return this.http
      .get<SaleResponse[] | PagedSalesResponse>(this.baseUrl)
      .pipe(map(response => this.normalizeSalesResponse(response)));
  }

  getSaleById(id: string): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${this.baseUrl}/${id}`);
  }

  createSale(payload: SaleRequest): Observable<SaleAsyncResponse> {
    return this.http.post<SaleAsyncResponse>(this.baseUrl, payload);
  }

  updateSale(id: string, payload: SaleRequest): Observable<SaleAsyncResponse> {
    return this.http.put<SaleAsyncResponse>(`${this.baseUrl}/${id}`, payload);
  }

  patchSaleStatus(id: string, status: SaleStatus): Observable<SaleAsyncResponse> {
    return this.http.patch<SaleAsyncResponse>(`${this.baseUrl}/${id}`, { status });
  }

  deleteSale(id: string): Observable<SaleAsyncResponse> {
    return this.http.delete<SaleAsyncResponse>(`${this.baseUrl}/${id}`);
  }

  getSalePreparations(saleId: string): Observable<RecipePreparationTrace[]> {
    return this.http.get<RecipePreparationTrace[]>(`${this.baseUrl}/${saleId}/preparations`);
  }

  getPreparationById(traceId: string): Observable<RecipePreparationTrace> {
    return this.http.get<RecipePreparationTrace>(`${this.baseUrl}/preparations/${traceId}`);
  }

  private normalizeSalesResponse(response: SaleResponse[] | PagedSalesResponse): SaleResponse[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && Array.isArray(response.content)) {
      return response.content;
    }

    return [];
  }
}
