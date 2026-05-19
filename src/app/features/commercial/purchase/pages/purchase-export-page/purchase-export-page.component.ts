import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
          <h1>Exportar PDF — Metabase</h1>
          <p>Configura los filtros y abre el reporte en Metabase</p>
        </div>
      </header>

      <section class="card">
        <div class="section-title">Filtros del reporte</div>

        <div class="filters-grid">

          <div class="field">
            <label>Fecha inicio</label>
            <input type="date" [(ngModel)]="startDate" />
          </div>

          <div class="field">
            <label>Fecha fin</label>
            <input type="date" [(ngModel)]="endDate" />
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

        @if (!metabaseUrl) {
          <div class="alert-warning">
            La URL de Metabase no está configurada. Agrega
            <code>METABASE_URL</code> en tu archivo <code>.env.development</code>.
          </div>
        }

        <div class="form-actions">
          <button
            class="btn-primary"
            (click)="openMetabase()"
            [disabled]="!metabaseUrl"
          >
            Abrir reporte en Metabase
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

  // Lee la URL base de Metabase desde el entorno
  metabaseUrl = (ENV as any).metabaseUrl ?? '';

  constructor(
    private providerService: ProviderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.providerService
      .getActiveProviders()
      .subscribe(data => this.providers = data);
  }

  openMetabase(): void {
    if (!this.metabaseUrl) return;

    const base = this.metabaseUrl.replace(/\/$/, '');
    const url = new URL(base);

    if (this.startDate) url.searchParams.set('startDate', this.startDate);
    if (this.endDate)   url.searchParams.set('endDate', this.endDate);
    if (this.status)    url.searchParams.set('status', this.status);
    if (this.providerId) url.searchParams.set('providerId', this.providerId);

    window.open(url.toString(), '_blank');
  }
  goBack(): void {
    this.router.navigate(['/commercial/purchases']);
  }
}