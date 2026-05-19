import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subject, takeUntil } from 'rxjs';
import { PurchaseService } from '../../services/purchase.service';
import { ENV } from '@config/env.config';
import { PurchaseResponse, PurchaseStatus, UpdatePurchaseStatusRequest } from '../../models/purchase.model';
import { ApprovePurchaseModalComponent } from '../../components/approve-purchase-modal/approve-purchase-modal.component';
import { ReceivePurchaseModalComponent } from '../../components/receive-purchase-modal/receive-purchase-modal.component';
import { ProviderService } from '../../services/provider.service';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
    imports: [CommonModule, FormsModule, ApprovePurchaseModalComponent, ReceivePurchaseModalComponent],
  template: `
    <div class="purchase-page">
      <header class="page-header">
        <div>
          <h1>Gestión de Compras</h1>
          <p>Administra órdenes de compra, estado y recepción de productos.</p>
        </div>
<div class="header-actions">
          <button class="btn-secondary" (click)="goToExport()">Exportar PDF</button>
          <button class="btn-primary" (click)="openCreate()">+ Nueva Compra</button>
        </div>
      </header>

      <section class="card filters-grid">
        <div class="field"><label>Estado</label><select [(ngModel)]="statusFilter" (ngModelChange)="onDynamicFilterChange()"><option value="">Todos</option><option value="CREATED">CREADA</option><option value="APPROVED">APROBADA</option><option value="RECEIVED">RECIBIDA</option><option value="CANCELLED">CANCELADA</option></select></div>
        <div class="field"><label>N° Orden</label><input [(ngModel)]="orderNumberFilter" (ngModelChange)="onDynamicFilterChange()" /></div>
        <div class="field"><label>Proveedor</label><select [(ngModel)]="providerFilter" (ngModelChange)="onDynamicFilterChange()"><option value="">Todos</option>@for (s of suppliers; track s.id) {<option [value]="s.id">{{ s.name }}</option>}</select></div>
        <div class="field"><label>Producto</label><input [(ngModel)]="productFilter" (ngModelChange)="onDynamicFilterChange()" /></div>
        <div class="field"><label>Fecha inicio</label><input type="date" [(ngModel)]="startDateFilter" /></div>
        <div class="field"><label>Fecha fin</label><input type="date" [(ngModel)]="endDateFilter" /></div>
        <div class="field field-action"><button class="btn-secondary" (click)="applyDateFilters()">Aplicar fechas</button></div>
      </section>

      <section class="card">
        @if (loading()) {<div class="state-message">Cargando...</div>} @else if (filteredPurchases().length === 0) {<div class="state-message">Sin resultados</div>} @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Número</th><th>Proveedor</th><th>Estado</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
              @for (purchase of filteredPurchases(); track purchase.id) {
              <tr>
                <td>{{ purchase.orderNumber }}</td>
                <td>{{ getSupplierName(purchase.providerId) }}</td>
                <td><span class="badge" [ngClass]="statusClassMap[purchase.status]">{{ purchase.status | uppercase }}</span></td>
                <td>{{ purchase.total | currency }}</td>
                <td>{{ purchase.createdDate | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-btn" title="Detalle" (click)="openDetail(purchase)">👁️</button>
                    @if (purchase.status === 'CREATED') {<button class="icon-btn" title="Editar" (click)="openEdit(purchase)">✏️</button>}
                    @if (purchase.status === 'CREATED') {<button class="icon-btn" title="Aprobar" (click)="openApprove(purchase)">✅</button>}
                    @if (purchase.status === 'APPROVED') {<button class="icon-btn" title="Recibir" (click)="openReceive(purchase)">📦</button>}
                    @if (purchase.status === 'CREATED' || purchase.status === 'APPROVED') {<button class="icon-btn danger" title="Cancelar" (click)="openCancel(purchase)">✕</button>}
                  </div>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pagination"><button (click)="prevPage()" [disabled]="page() === 0">←</button><span>Mostrando {{ rangeStart() }} - {{ rangeEnd() }} de {{ totalElements() }} compras</span><button (click)="nextPage()" [disabled]="page() >= totalPages() - 1">→</button></div>
        }
      </section>
    </div>

    <app-approve-purchase-modal [open]="approveModalOpen()" [purchase]="selectedPurchase()" (onOpenChange)="approveModalOpen.set($event)" (onConfirm)="confirmApprove()" />
    <app-receive-purchase-modal [open]="receiveModalOpen()" [purchase]="selectedPurchase()" (onOpenChange)="receiveModalOpen.set($event)" (onConfirm)="confirmReceive()" />
  `,
  styleUrl: 'purchase-list.component.css'
})

export class PurchaseListComponent implements OnInit, OnDestroy {
  purchases = signal<PurchaseResponse[]>([]);
  loading = signal(false);
  page = signal(0);
  totalPages = signal(1);
  totalElements = signal(0);
  size = signal(10);
  statusFilter: PurchaseStatus | '' = '';
  orderNumberFilter = '';
  providerFilter = '';
  productFilter = '';
  startDateFilter = '';
  endDateFilter = '';

  appliedStartDate = signal('');
  appliedEndDate = signal('');
  approveModalOpen = signal(false);
  receiveModalOpen = signal(false);
  selectedPurchase = signal<PurchaseResponse | null>(null);
  suppliers: { id: string; name: string }[] = [];
  availableProducts: { id: string; name: string; unitPrice: number }[] = [];
  statusClassMap: Record<PurchaseStatus, string> = { CREATED: 'badge-gray', APPROVED: 'badge-yellow', RECEIVED: 'badge-green', CANCELLED: 'badge-red' };
  private locationId = ENV.locationId;
  private destroy$ = new Subject<void>();

  filteredPurchases = computed(() => this.purchases().filter(p => p.orderNumber.toLowerCase().includes(this.orderNumberFilter.toLowerCase()) && (!this.providerFilter || p.providerId === this.providerFilter) && (!this.productFilter || p.items.some(i => this.getProductName(i.productId).toLowerCase().includes(this.productFilter.toLowerCase()))) && (!this.appliedStartDate() || new Date(p.createdDate) >= new Date(`${this.appliedStartDate()}T00:00:00`)) && (!this.appliedEndDate() || new Date(p.createdDate) <= new Date(`${this.appliedEndDate()}T23:59:59`))));
  rangeStart = computed(() => this.totalElements() === 0 ? 0 : this.page() * this.size());
  rangeEnd = computed(() => Math.min((this.page() + 1) * this.size(), this.totalElements()));

  constructor(private purchaseService: PurchaseService, private providerService: ProviderService, private productService: ProductService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit(): void { this.loadPurchases(); this.loadSuppliers(); this.loadProducts(); interval(10000).pipe(takeUntil(this.destroy$)).subscribe(() => this.loadPurchases(false)); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  onDynamicFilterChange(): void { this.page.set(0); this.loadPurchases(); }
  applyDateFilters(): void { this.appliedStartDate.set(this.startDateFilter); this.appliedEndDate.set(this.endDateFilter); }
  loadPurchases(showLoading = true): void {
    if (!this.locationId) return;

    if (showLoading) {
      this.loading.set(true);
    }

    this.purchaseService
      .getPurchases(
        this.locationId,
        this.statusFilter || undefined,
        this.page(),
        this.size()
      )
      .subscribe({
        next: d => {
          this.purchases.set(d.content ?? []);

          const pageInfo = d.page;

          if (pageInfo) {
            this.page.set(pageInfo.number ?? 0);
            this.size.set(pageInfo.size ?? 10);
            this.totalPages.set(pageInfo.totalPages ?? 1);
            this.totalElements.set(
              pageInfo.totalElements ?? 0
            );
          }

          this.loading.set(false);
        },

        error: () => {
          this.purchases.set([]);
          this.loading.set(false);
        }
      });
  }
  loadSuppliers(): void { this.providerService.getActiveProviders().subscribe(d => this.suppliers = d.map(p => ({ id: p.id, name: p.businessName }))); }
  loadProducts(): void { this.productService.getByLocation(this.locationId).subscribe(d => this.availableProducts = d.content.map(p => ({ id: p.id, name: p.name, unitPrice: p.salePrice }))); }
  getSupplierName(id: string): string { return this.suppliers.find(s => s.id === id)?.name ?? id; }
  getProductName(id: string): string { return this.availableProducts.find(p => p.id === id)?.name ?? id; }
  openCreate(): void {
    this.router.navigate(['/commercial/purchases/create']);
  }
  openDetail(p: PurchaseResponse): void {
    this.router.navigate([
      '/commercial/purchases',
      p.id,
      'detail'
    ]);
  }
  openEdit(p: PurchaseResponse): void {
    this.router.navigate([
      '/commercial/purchases',
      p.id,
      'edit'
    ]);
  }

  openCancel(p: PurchaseResponse): void {
    this.router.navigate([
      '/commercial/purchases',
      p.id,
      'cancel'
    ]);
  }

  goToExport(): void {
    this.router.navigate([
      '/commercial/purchases/export/pdf'
    ]);
  }
  openApprove(p: PurchaseResponse): void { this.selectedPurchase.set(p); this.approveModalOpen.set(true); }
  openReceive(p: PurchaseResponse) { this.selectedPurchase.set(p); this.receiveModalOpen.set(true); }
  confirmApprove() { const s = this.selectedPurchase(); if (!s) return; const r: UpdatePurchaseStatusRequest = { status: 'APPROVED' }; this.purchaseService.updateStatus(this.locationId, s.id, r).subscribe(() => { this.approveModalOpen.set(false); this.loadPurchases(); }); }
  confirmReceive() { const s = this.selectedPurchase(); if (!s) return; const r: UpdatePurchaseStatusRequest = { status: 'RECEIVED' }; this.purchaseService.updateStatus(this.locationId, s.id, r).subscribe(() => { this.receiveModalOpen.set(false); this.loadPurchases(); }); }
  prevPage() { if (this.page() > 0) { this.page.update(v => v - 1); this.loadPurchases(); } }
  nextPage() { if (this.page() < this.totalPages() - 1) { this.page.update(v => v + 1); this.loadPurchases(); } }
}