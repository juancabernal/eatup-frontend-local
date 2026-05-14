import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CashReceiptService } from '@payment/cashreceipt/services/cash-receipt.service';
import { CashReceiptResponse, PageResponse, InvoiceResponse } from '@payment/cashreceipt/models/cashreceipt.model';
import { PaymentMethodResponse } from '@payment/paymentmethod/models/payment-method.model';
import { HttpClient } from '@angular/common/http';
import { ENV } from '@config/env.config';

@Component({
  selector: 'app-cash-receipt-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Recibos de Caja</h1>
        <p class="page-subtitle">Historial de pagos aplicados a facturas de la sede.</p>
      </div>
      <a class="btn-primary" routerLink="create">+ Nuevo Recibo</a>
    </div>

    @if (isLoading()) {
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Cargando recibos...</p>
      </div>
    }

    @if (error()) {
      <div class="alert-error">
        <strong>Error:</strong> {{ error() }}
      </div>
    }

    @if (!isLoading() && !error()) {
      @if (page()?.content?.length === 0) {
        <div class="empty-state">
          <p>No hay recibos de caja registrados para esta sede.</p>
          <a class="btn-primary" routerLink="create">Crear primer recibo</a>
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Método de Pago</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (receipt of page()?.content ?? []; track receipt.id) {
                <tr>
                  <td class="mono">#{{ receipt.invoiceNumber }}</td>
                  <td>{{ receipt.paymentMethodName }}</td>
                  <td>{{ receipt.amount | currency:'COP':'symbol-narrow':'1.0-2' }}</td>
                  <td>
                    <span [class]="'badge badge-' + receipt.status.toLowerCase()">
                      {{ receipt.status }}
                    </span>
                  </td>
                  <td>{{ receipt.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    @if (receipt.status === 'ACTIVE') {
                      <button
                        class="btn-danger-sm"
                        [disabled]="cancelling() === receipt.id"
                        (click)="cancelReceipt(receipt.id)">
                        {{ cancelling() === receipt.id ? 'Anulando…' : 'Anular' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="pagination">
          <button
            class="btn-secondary"
            [disabled]="page()?.first"
            (click)="goToPage((page()?.number ?? 0) - 1)">
            ← Anterior
          </button>
          <span>Página {{ (page()?.number ?? 0) + 1 }} de {{ page()?.totalPages }}</span>
          <button
            class="btn-secondary"
            [disabled]="page()?.last"
            (click)="goToPage((page()?.number ?? 0) + 1)">
            Siguiente →
          </button>
        </div>
      }
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--color-secondary);
      margin: 0 0 0.25rem 0;
    }
    .page-subtitle { color: #64748b; margin: 0; font-size: 0.9375rem; }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      background: var(--color-primary);
      color: white;
      padding: 0.6rem 1.25rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.875rem;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .btn-primary:hover { opacity: 0.9; }

    .btn-secondary {
      background: white;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary:not(:disabled):hover { background: #f1f5f9; }

    .btn-danger-sm {
      background: #fee2e2;
      color: #dc2626;
      border: none;
      padding: 0.35rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-danger-sm:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger-sm:not(:disabled):hover { background: #fecaca; }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 4rem 0;
      color: #64748b;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem 1.25rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 0;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
    }

    .table-wrapper {
      background: white;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .data-table thead { background: #f8fafc; }
    .data-table th {
      padding: 0.875rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #64748b;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table td {
      padding: 0.875rem 1rem;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: #f8fafc; }
    .mono { font-family: monospace; font-size: 0.8125rem; color: #64748b; }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-active { background: #dcfce7; color: #16a34a; }
    .badge-cancelled { background: #fee2e2; color: #dc2626; }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: #64748b;
    }
  `]
})
export class CashReceiptListComponent implements OnInit {
  private readonly service = inject(CashReceiptService);

  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<PageResponse<CashReceiptResponse> | null>(null);
  protected readonly cancelling = signal<string | null>(null);
  private readonly http = inject(HttpClient);

  // Caches para evitar peticiones repetidas
  private readonly invoiceCache = new Map<string, string>();
  private readonly methodCache = new Map<string, string>();

  private readonly locationId = ENV.locationId;

  ngOnInit(): void {
    this.load(0);
  }

  protected goToPage(pageNumber: number): void {
    this.load(pageNumber);
  }

  protected cancelReceipt(id: string): void {
    if (!confirm('¿Deseas anular este recibo de caja?')) return;
    this.cancelling.set(id);
    this.service.cancel(this.locationId, id).subscribe({
      next: () => {
        this.cancelling.set(null);
        this.load(this.page()?.number ?? 0);
      },
      error: (err) => {
        this.cancelling.set(null);
        this.error.set(err?.error?.message ?? 'Error al anular el recibo.');
      }
    });
  }

  private load(pageNumber: number): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.service.getAll(this.locationId, pageNumber).subscribe({
      next: (data) => {
        this.page.set(data);
        this.isLoading.set(false);
        this.hydrateNames(data.content);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar los recibos de caja.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Intenta obtener los nombres/números faltantes desde el frontend.
   */
  private hydrateNames(receipts: CashReceiptResponse[]): void {
    receipts.forEach(receipt => {
      /* 
      // Hidratar Número de Factura (Deshabilitado temporalmente)
      if (!receipt.invoiceNumber && receipt.invoiceId) {
        if (this.invoiceCache.has(receipt.invoiceId)) {
          receipt.invoiceNumber = this.invoiceCache.get(receipt.invoiceId)!;
          this.refreshSignal();
        } else {
          this.http.get<InvoiceResponse>(`${ENV.apiUrl}/locations/${this.locationId}/invoices/${receipt.invoiceId}`)
            .subscribe({
              next: (inv) => {
                receipt.invoiceNumber = inv.invoiceNumber;
                this.invoiceCache.set(receipt.invoiceId, inv.invoiceNumber);
                this.refreshSignal();
              }
            });
        }
      }
      */

      // Hidratar Nombre de Método de Pago
      if (!receipt.paymentMethodName && receipt.paymentMethodId) {
        if (this.methodCache.has(receipt.paymentMethodId)) {
          receipt.paymentMethodName = this.methodCache.get(receipt.paymentMethodId)!;
          this.refreshSignal();
        } else {
          this.ensureMethodsLoaded(receipt);
        }
      }
    });
  }

  /**
   * Refresca el signal para que Angular detecte los cambios en los objetos internos
   */
  private refreshSignal(): void {
    const currentPage = this.page();
    if (currentPage) {
      this.page.set({ ...currentPage });
    }
  }

  private ensureMethodsLoaded(receipt: CashReceiptResponse): void {
    if (this.methodCache.size > 0) {
      if (this.methodCache.has(receipt.paymentMethodId)) {
        receipt.paymentMethodName = this.methodCache.get(receipt.paymentMethodId)!;
        this.refreshSignal();
      }
      return;
    }

    this.http.get<PaymentMethodResponse[]>(`${ENV.apiUrl}/payment-methods/all`)
      .subscribe({
        next: (methods) => {
          methods.forEach(m => this.methodCache.set(m.id, m.name));
          if (this.methodCache.has(receipt.paymentMethodId)) {
            receipt.paymentMethodName = this.methodCache.get(receipt.paymentMethodId)!;
            this.refreshSignal();
          }
        }
      });
  }

}
