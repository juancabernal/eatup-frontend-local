import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENV } from '@config/env.config';
import { ProviderService, ProviderDTO } from '../../services/provider.service';

@Component({
  selector: 'app-purchase-export-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="purchase-page">

      <header class="page-header">
        <div>
          <button class="btn-link" (click)="goBack()">← Volver</button>
          <h1>Exportar Compras</h1>
          <p>Aplica los filtros y descarga el PDF directamente.</p>
        </div>
      </header>

      <section class="card">
        <div class="section-title">Filtros del reporte</div>

        <div class="filters-grid">
          <div class="field">
            <label>Fecha inicio</label>
            <input type="date" [(ngModel)]="startDate" [max]="today" (ngModelChange)="onStartDateChange()" />
          </div>
          <div class="field">
            <label>Fecha fin</label>
            <input type="date" [(ngModel)]="endDate" [min]="startDate || undefined" [max]="today" />
          </div>
          <div class="field">
            <label>Estado</label>
            <select [(ngModel)]="status">
              <option value="">Todos los estados</option>
              <option value="CREATED">CREADA</option>
              <option value="APPROVED">APROBADA</option>
              <option value="RECEIVED">RECIBIDA</option>
              <option value="CANCELLED">CANCELADA</option>
            </select>
          </div>
          <div class="field">
            <label>Proveedor</label>
            <select [(ngModel)]="providerId">
              <option value="">Todos los proveedores</option>
              @for (p of providers; track p.id) {
                <option [value]="p.id">{{ p.businessName }}</option>
              }
            </select>
          </div>
        </div>

        @if (error()) {
          <div class="alert-warning">{{ error() }}</div>
        }

        <div class="form-actions">
          <button class="btn-primary" (click)="downloadPdf()" [disabled]="loading()">
            {{ loading() ? 'Generando PDF...' : '⬇ Descargar PDF' }}
          </button>
        </div>
      </section>

    </div>
  `,
  styleUrl: 'purchase-export-page.component.css'
})
export class PurchaseExportPageComponent implements OnInit {

  startDate = '';
  endDate = '';
  status = '';
  providerId = '';
  providers: ProviderDTO[] = [];
  loading = signal(false);
  error = signal('');
  today = new Date().toISOString().split('T')[0];

  private locationId = ENV.locationId;

  constructor(
    private http: HttpClient,
    private providerService: ProviderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.providerService.getActiveProviders().subscribe(data => this.providers = data);
  }

  onStartDateChange(): void {
    if (this.endDate && this.startDate && this.endDate < this.startDate) {
      this.endDate = '';
    }
  }

  downloadPdf(): void {
    this.error.set('');
    this.loading.set(true);

    let params = new HttpParams();
    if (this.status)     params = params.set('status', this.status);
    if (this.providerId) params = params.set('providerId', this.providerId);
    if (this.startDate)  params = params.set('startDate', this.startDate);
    if (this.endDate)    params = params.set('endDate', this.endDate);

    const url = `${ENV.apiUrl}/api/v1/locations/${this.locationId}/purchases/export/pdf`;

    this.http.get(url, { params, responseType: 'blob' }).subscribe({
      next: (blob) => {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `compras-${date}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo generar el PDF. Verifica los filtros e intenta de nuevo.');
        this.loading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/commercial/purchases']);
  }
}