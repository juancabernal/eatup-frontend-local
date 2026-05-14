import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CashReceiptService } from '@payment/cashreceipt/services/cash-receipt.service';
import { PaymentMethodService } from '@payment/paymentmethod/services/payment-method.service';
import { CreateCashReceiptRequest } from '@payment/cashreceipt/models/cashreceipt.model';
import { PaymentMethodResponse } from '@payment/paymentmethod/models/payment-method.model';
import { ENV } from '@config/env.config';

@Component({
  selector: 'app-cash-receipt-create',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <a class="back-link" routerLink="..">← Volver a recibos</a>
        <h1 class="page-title">Nuevo Recibo de Caja</h1>
        <p class="page-subtitle">
          Registra un pago aplicado a una factura. Por ahora, el proceso es directo y simplificado.
        </p>
      </div>
    </div>

    <div class="form-card">
      <div class="step">
        <div class="step-header">
          <span class="step-number">1</span>
          <h2>Datos de la Factura</h2>
        </div>
        <div class="field-group">
          <label for="invoiceId">ID de Factura (UUID)</label>
          <input
            id="invoiceId"
            type="text"
            class="input"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            [(ngModel)]="invoiceId">
        </div>
      </div>

      <div class="step">
        <div class="step-header">
          <span class="step-number">2</span>
          <h2>Método de Pago</h2>
        </div>
        @if (loadingMethods()) {
          <p class="loading-text">Cargando métodos de pago…</p>
        } @else {
          <div class="method-grid">
            @for (method of paymentMethods(); track method.id) {
              <button
                [class]="'method-card' + (selectedMethodId() === method.id ? ' selected' : '') + (!method.active ? ' disabled' : '')"
                [disabled]="!method.active"
                (click)="selectMethod(method.id)">
                <span class="method-name">{{ method.name }}</span>
                <span class="method-desc">{{ method.description }}</span>
                @if (!method.active) {
                  <span class="method-inactive">Inactivo</span>
                }
              </button>
            }
          </div>
        }
      </div>

      <div class="step">
        <div class="step-header">
          <span class="step-number">3</span>
          <h2>Monto a pagar</h2>
        </div>
        <div class="field-group">
          <label for="amount">Valor del pago</label>
          <input
            id="amount"
            type="number"
            class="input input-amount"
            placeholder="0.00"
            min="0.01"
            [(ngModel)]="amount">
        </div>
      </div>

      <div class="form-actions">
        @if (submitError()) {
          <div class="alert-error">{{ submitError() }}</div>
        }
        @if (successMsg()) {
          <div class="alert-success">{{ successMsg() }}</div>
        }
        <button
          class="btn-primary"
          [disabled]="submitting() || !invoiceId || !selectedMethodId() || amount <= 0"
          (click)="submit()">
          {{ submitting() ? 'Procesando…' : 'Aplicar Pago' }}
        </button>
        <a class="btn-ghost" routerLink="..">Cancelar</a>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 2rem; }
    .back-link { display: inline-block; margin-bottom: 0.75rem; font-size: 0.875rem; color: var(--color-primary); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: var(--color-secondary); margin: 0 0 0.25rem 0; }
    .page-subtitle { color: #64748b; margin: 0; font-size: 0.9375rem; max-width: 600px; }
    .form-card { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 2rem; display: flex; flex-direction: column; gap: 2rem; max-width: 680px; }
    .step { display: flex; flex-direction: column; gap: 1.25rem; }
    .step-header { display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; }
    .step-number { width: 28px; height: 28px; background: var(--color-background); color: var(--color-primary); border-radius: 50%; border: 1px solid var(--color-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0; }
    .step-header h2 { font-size: 1rem; font-weight: 600; color: #1e293b; margin: 0; }
    .field-group { display: flex; flex-direction: column; gap: 0.5rem; }
    label { font-size: 0.875rem; font-weight: 600; color: #374151; }
    .input { padding: 0.625rem 0.875rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.9375rem; color: #1e293b; transition: border-color 0.2s; }
    .input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(255,107,53,0.2); }
    .input-amount { max-width: 200px; }
    .btn-primary { background: var(--color-primary); color: white; padding: 0.65rem 1.5rem; border: none; border-radius: 0.5rem; font-weight: 600; font-size: 0.9375rem; cursor: pointer; transition: background 0.2s; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: none; border: none; color: var(--color-primary); font-size: 0.875rem; cursor: pointer; padding: 0.625rem 0.5rem; text-decoration: none; }
    .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; }
    .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; }
    .loading-text { color: #64748b; font-size: 0.9375rem; }
    .method-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }
    .method-card { display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem; border: 2px solid #e2e8f0; border-radius: 0.625rem; background: white; cursor: pointer; text-align: left; transition: border-color 0.2s, background 0.2s; }
    .method-card:hover:not(.disabled) { border-color: var(--color-accent); background: var(--color-background); }
    .method-card.selected { border-color: var(--color-primary); background: var(--color-background); }
    .method-card.disabled { opacity: 0.45; cursor: not-allowed; }
    .method-name { font-weight: 600; font-size: 0.9375rem; color: #1e293b; }
    .method-desc { font-size: 0.8125rem; color: #64748b; }
    .method-inactive { font-size: 0.75rem; color: #dc2626; font-weight: 600; }
    .form-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 1.5rem; }
  `]
})
export class CashReceiptCreateComponent implements OnInit {
  private readonly service = inject(CashReceiptService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly router = inject(Router);

  // ── Form state ──
  protected invoiceId = '';
  protected amount = 0;

  // ── Signals ──
  protected readonly paymentMethods = signal<PaymentMethodResponse[]>([]);
  protected readonly selectedMethodId = signal<string | null>(null);
  protected readonly loadingMethods = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);

  private readonly locationId = ENV.locationId;

  ngOnInit(): void {
    this.loadPaymentMethods();
  }

  protected selectMethod(id: string): void {
    this.selectedMethodId.set(id);
  }

  protected submit(): void {
    const invoiceId = this.invoiceId.trim();
    const paymentMethodId = this.selectedMethodId();
    if (!invoiceId || !paymentMethodId || this.amount <= 0) return;

    this.submitting.set(true);
    this.submitError.set(null);
    this.successMsg.set(null);

    const request: CreateCashReceiptRequest = {
      invoiceId,
      paymentMethodId,
      amount: this.amount
    };

    this.service.create(this.locationId, request).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.successMsg.set(
          `${res.message} — el sistema procesará el pago y actualizará el estado de la factura.`
        );
        setTimeout(() => this.router.navigate(['/payment/cashreceipt']), 2500);
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.message ?? 'Error al procesar el pago.');
      }
    });
  }

  private loadPaymentMethods(): void {
    this.loadingMethods.set(true);
    this.paymentMethodService.getActive().subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods);
        this.loadingMethods.set(false);
      },
      error: () => {
        this.loadingMethods.set(false);
      }
    });
  }
}
