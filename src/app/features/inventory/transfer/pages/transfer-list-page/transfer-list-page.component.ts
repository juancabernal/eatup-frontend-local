import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ENV } from '@config/env.config';
import {
  TransferListFilter,
  TransferResponse
} from '../../models/transfer.model';
import { TransferService } from '../../services/transfer.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-transfer-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <div class="page-shell">
      <div class="hero-card">
        <div>
          <p class="eyebrow">Inventory / Transfer</p>
          <h1>Traslados entre sedes</h1>
          <p>
            Desde aqui origen despacha o cancela, y destino completa o reclama cuando recibe.
          </p>
        </div>
        <a class="btn-primary" routerLink="create">Crear traslado</a>
      </div>

      <div class="filter-bar">
        @for (option of filters; track option.value) {
          <button
            type="button"
            class="filter-chip"
            [class.active]="selectedFilter() === option.value"
            [disabled]="isLoading()"
            (click)="loadTransfers(option.value)">
            {{ option.label }}
          </button>
        }
      </div>

      @if (bannerMessage()) {
        <div class="alert-success">{{ bannerMessage() }}</div>
      }

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (isLoading()) {
        <div class="loading-card">
          <div class="spinner"></div>
          <p>Cargando traslados...</p>
        </div>
      } @else if (!transfers().length) {
        <div class="empty-card">
          <h2>No hay traslados para este filtro</h2>
          <p>Crea un traslado nuevo o cambia de vista para revisar otros estados.</p>
        </div>
      } @else {
        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Ruta</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (transfer of transfers(); track transfer.idTraslado) {
                <tr>
                  <td class="mono">#{{ transfer.idTraslado }}</td>
                  <td>
                    <div class="primary-cell">{{ transfer.producto }}</div>
                    <div class="secondary-cell">Cantidad: {{ transfer.cantidad }}</div>
                  </td>
                  <td>
                    <div class="primary-cell">{{ shortLocation(transfer.sedeOrigen) }} -> {{ shortLocation(transfer.sedeDestino) }}</div>
                    <div class="secondary-cell">{{ roleLabel(transfer) }}</div>
                  </td>
                  <td>
                    <div class="primary-cell">Sale: {{ transfer.fechaEnvio | date:'dd/MM/yyyy HH:mm' }}</div>
                    <div class="secondary-cell">Llega: {{ transfer.fechaLlegada | date:'dd/MM/yyyy HH:mm' }}</div>
                  </td>
                  <td>
                    <span class="status-pill" [class]="statusClass(transfer.estado)">
                      {{ transfer.estado }}
                    </span>
                  </td>
                  <td>
                    <div class="primary-cell">{{ transfer.responsable }}</div>
                    @if (transfer.observaciones) {
                      <div class="secondary-cell truncate">{{ transfer.observaciones }}</div>
                    }
                  </td>
                  <td>
                    <div class="action-stack">
                      @if (canSendToTransit(transfer)) {
                        <button
                          class="btn-secondary"
                          [disabled]="processingId() === transfer.idTraslado"
                          (click)="sendToTransit(transfer)">
                          {{ processingId() === transfer.idTraslado ? 'Enviando...' : 'Pasar a transito' }}
                        </button>
                      }

                      @if (canCancel(transfer)) {
                        <button
                          class="btn-danger"
                          [disabled]="processingId() === transfer.idTraslado"
                          (click)="cancelTransfer(transfer)">
                          {{ processingId() === transfer.idTraslado ? 'Cancelando...' : 'Cancelar' }}
                        </button>
                      }

                      @if (canConfirm(transfer)) {
                        <button
                          class="btn-success"
                          [disabled]="processingId() === transfer.idTraslado"
                          (click)="confirmTransfer(transfer)">
                          {{ processingId() === transfer.idTraslado ? 'Completando...' : 'Completar' }}
                        </button>
                      }

                      @if (canClaim(transfer)) {
                        <button
                          class="btn-warning"
                          [disabled]="processingId() === transfer.idTraslado"
                          (click)="toggleClaim(transfer.idTraslado)">
                          {{ openClaimId() === transfer.idTraslado ? 'Cerrar reclamo' : 'Reclamar' }}
                        </button>
                      }
                    </div>

                    @if (openClaimId() === transfer.idTraslado) {
                      <div class="claim-box">
                        <label [for]="'claim-' + transfer.idTraslado">Observaciones del reclamo</label>
                        <textarea
                          [id]="'claim-' + transfer.idTraslado"
                          [(ngModel)]="claimText"
                          rows="3"
                          placeholder="Ej. llego incompleto o con novedad"></textarea>
                        <button
                          class="btn-warning btn-full"
                          [disabled]="processingId() === transfer.idTraslado || !claimText.trim()"
                          (click)="submitClaim(transfer)">
                          {{ processingId() === transfer.idTraslado ? 'Enviando reclamo...' : 'Confirmar reclamo' }}
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; color: #0f172a; }
    .page-shell { display: flex; flex-direction: column; gap: 1.5rem; }
    .hero-card {
      background: linear-gradient(135deg, var(--color-secondary) 0%, #2f2f2f 100%);
      color: white;
      padding: 1.75rem;
      border-radius: 1rem;
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      align-items: flex-end;
    }
    .eyebrow { margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; opacity: 0.7; }
    .hero-card h1 { margin: 0; font-size: 2rem; line-height: 1.05; }
    .hero-card p { max-width: 640px; margin: 0.75rem 0 0; color: rgba(255, 255, 255, 0.8); }
    .filter-bar { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .filter-chip {
      border: 1px solid #cbd5e1;
      background: white;
      border-radius: 999px;
      padding: 0.6rem 1rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
    }
    .filter-chip.active { background: var(--color-secondary); border-color: var(--color-secondary); color: white; }
    .filter-chip:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary, .btn-secondary, .btn-danger, .btn-success, .btn-warning {
      border: none;
      border-radius: 0.7rem;
      padding: 0.65rem 1rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-primary { background: var(--color-primary); color: white; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.25); }
    .btn-secondary { background: #fff7ed; color: var(--color-primary); border: 1px solid #fed7aa; }
    .btn-danger { background: #fee2e2; color: #b91c1c; }
    .btn-success { background: rgba(46, 196, 182, 0.16); color: #0f766e; }
    .btn-warning { background: #fff7ed; color: #c2410c; }
    .btn-full { width: 100%; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .alert-success, .alert-error, .empty-card, .loading-card, .table-card {
      border-radius: 1rem;
      padding: 1.25rem;
      background: white;
      border: 1px solid #e2e8f0;
    }
    .alert-success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .alert-error { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
    .loading-card, .empty-card { text-align: center; color: #475569; padding: 3rem 1.5rem; }
    .spinner {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      margin: 0 auto 1rem;
      border: 3px solid #ffe2d6;
      border-top-color: var(--color-primary);
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .table-card { overflow: auto; padding: 0; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 1040px; }
    .data-table th {
      background: linear-gradient(to right, #fff7ed, #fff);
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.75rem;
      padding: 1rem;
      text-align: left;
    }
    .data-table td { padding: 1rem; border-top: 1px solid #f1f5f9; vertical-align: top; }
    .primary-cell { font-weight: 600; color: #0f172a; }
    .secondary-cell { color: #64748b; font-size: 0.8125rem; margin-top: 0.25rem; }
    .truncate { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mono { font-family: monospace; color: #475569; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-en-proceso { background: #fff7ed; color: #c2410c; }
    .status-en-transito { background: rgba(46, 196, 182, 0.14); color: #0f766e; }
    .status-completado { background: #dcfce7; color: #166534; }
    .status-cancelado { background: #fee2e2; color: #b91c1c; }
    .status-reclamado { background: #fff7ed; color: #c2410c; }
    .action-stack { display: flex; flex-direction: column; gap: 0.5rem; min-width: 150px; }
    .claim-box {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: var(--color-background);
      border: 1px solid #fed7aa;
      border-radius: 0.75rem;
      padding: 0.75rem;
    }
    .claim-box label { font-size: 0.8125rem; font-weight: 700; color: #9a3412; }
    .claim-box textarea {
      border: 1px solid #fdba74;
      border-radius: 0.65rem;
      padding: 0.75rem;
      resize: vertical;
      font: inherit;
    }
    @media (max-width: 900px) {
      .hero-card { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class TransferListPageComponent implements OnInit {
  private readonly transferService = inject(TransferService);

  protected readonly locationId = ENV.locationId;
  protected readonly filters: Array<{ label: string; value: TransferListFilter }> = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Entrantes', value: 'ENTRANTES' },
    { label: 'En transito', value: 'EN_TRANSITO' },
    { label: 'Completados', value: 'COMPLETADOS' },
    { label: 'Cancelados', value: 'CANCELADOS' },
    { label: 'Reclamados', value: 'RECLAMADOS' }
  ];

  protected readonly transfers = signal<TransferResponse[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly bannerMessage = signal<string | null>(null);
  protected readonly selectedFilter = signal<TransferListFilter>('TODOS');
  protected readonly processingId = signal<number | null>(null);
  protected readonly openClaimId = signal<number | null>(null);
  protected claimText = '';

  ngOnInit(): void {
    this.loadTransfers('TODOS');
  }

  protected loadTransfers(filter: TransferListFilter): void {
    this.selectedFilter.set(filter);
    this.isLoading.set(true);
    this.error.set(null);
    this.bannerMessage.set(null);
    this.openClaimId.set(null);
    this.claimText = '';

    let request$: Observable<TransferResponse[]>;

    switch (filter) {
      case 'ENTRANTES':
        request$ = this.transferService.getIncoming(this.locationId);
        break;
      case 'EN_TRANSITO':
        request$ = this.transferService.getInTransit();
        break;
      case 'COMPLETADOS':
        request$ = this.transferService.getCompleted();
        break;
      case 'CANCELADOS':
        request$ = this.transferService.getCancelled();
        break;
      case 'RECLAMADOS':
        request$ = this.transferService.getClaimed();
        break;
      default:
        request$ = this.transferService.getAll();
        break;
    }

    request$.subscribe({
      next: transfers => {
        this.transfers.set(transfers);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'No fue posible cargar los traslados.');
        this.transfers.set([]);
        this.isLoading.set(false);
      }
    });
  }

  protected canSendToTransit(transfer: TransferResponse): boolean {
    return transfer.sedeOrigen === this.locationId && transfer.estado === 'EN_PROCESO';
  }

  protected canCancel(transfer: TransferResponse): boolean {
    return transfer.sedeOrigen === this.locationId && transfer.estado === 'EN_PROCESO';
  }

  protected canConfirm(transfer: TransferResponse): boolean {
    return transfer.sedeDestino === this.locationId && transfer.estado === 'EN_TRANSITO';
  }

  protected canClaim(transfer: TransferResponse): boolean {
    return transfer.sedeDestino === this.locationId && transfer.estado === 'EN_TRANSITO';
  }

  protected sendToTransit(transfer: TransferResponse): void {
    this.runAction(
      transfer.idTraslado,
      this.transferService.sendToTransit(transfer.idTraslado, this.locationId),
      `Traslado #${transfer.idTraslado} enviado a transito.`
    );
  }

  protected cancelTransfer(transfer: TransferResponse): void {
    this.runAction(
      transfer.idTraslado,
      this.transferService.cancel(transfer.idTraslado, this.locationId),
      `Traslado #${transfer.idTraslado} cancelado correctamente.`
    );
  }

  protected confirmTransfer(transfer: TransferResponse): void {
    this.runAction(
      transfer.idTraslado,
      this.transferService.confirm(transfer.idTraslado, this.locationId),
      `Traslado #${transfer.idTraslado} completado y recibido.`
    );
  }

  protected toggleClaim(transferId: number): void {
    if (this.openClaimId() === transferId) {
      this.openClaimId.set(null);
      this.claimText = '';
      return;
    }

    this.openClaimId.set(transferId);
    this.claimText = '';
  }

  protected submitClaim(transfer: TransferResponse): void {
    const observaciones = this.claimText.trim();
    if (!observaciones) {
      return;
    }

    this.runAction(
      transfer.idTraslado,
      this.transferService.claim(transfer.idTraslado, this.locationId, { observaciones }),
      `Reclamo registrado para el traslado #${transfer.idTraslado}.`
    );
  }

  protected shortLocation(location: string): string {
    return location.slice(0, 8);
  }

  protected roleLabel(transfer: TransferResponse): string {
    if (transfer.sedeOrigen === this.locationId) {
      return 'Tu sede es origen';
    }
    if (transfer.sedeDestino === this.locationId) {
      return 'Tu sede es destino';
    }
    return 'Traslado de otra sede';
  }

  protected statusClass(status: TransferResponse['estado']): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  private runAction(
    transferId: number,
    request$: Observable<TransferResponse>,
    successMessage: string
  ): void {
    this.processingId.set(transferId);
    this.error.set(null);
    this.bannerMessage.set(null);

    request$.subscribe({
      next: () => {
        this.processingId.set(null);
        this.openClaimId.set(null);
        this.claimText = '';
        this.bannerMessage.set(successMessage);
        this.loadTransfers(this.selectedFilter());
      },
      error: err => {
        this.processingId.set(null);
        this.error.set(err?.error?.message ?? 'No fue posible ejecutar la accion.');
      }
    });
  }
}
