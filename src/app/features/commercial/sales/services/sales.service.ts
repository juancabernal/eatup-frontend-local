import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENV } from '@config/env.config';
import {
  RecipePreparationTrace,
  SaleAsyncResponse,
  SaleRequest,
  SaleResponse,
  SaleStatus
} from '@commercial/sales/models/sale.model';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${ENV.apiUrl.replace('/api/v1', '')}/commercial/api/v1/sales`;

  getSales(): Observable<SaleResponse[]> {
    return this.http.get<SaleResponse[]>(this.baseUrl);
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
}
