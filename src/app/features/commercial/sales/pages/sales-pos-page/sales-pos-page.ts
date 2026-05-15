import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, of, Subject, switchMap, takeUntil, catchError, tap } from 'rxjs';
import { SalesService } from '@commercial/sales/services/sales.service';
import { RecipeService } from '@commercial/sales/services/recipe.service';
import { RestaurantTable, RestaurantTableService } from '@commercial/sales/services/restaurant-table.service';
import { ENV } from '@config/env.config';
import { RecipePreparationTrace, SaleRequest, SaleResponse, SaleStatus } from '@commercial/sales/models/sale.model';
import { RecipeResponse, SaleableRecipe } from '@commercial/sales/models/recipe.model';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type VisibilityFilter = 'ALL' | 'VISIBLE' | 'HIDDEN';
type SortMode = 'NAME_ASC' | 'PRICE_ASC' | 'PRICE_DESC';
interface CartLine { recipeId: string; name: string; quantity: number; unitPrice: number; recipeLineComment: string; }

@Component({
  selector: 'app-sales-pos-page', standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './sales-pos-page.html', styleUrl: './sales-pos-page.css'
})
export class SalesPosPage implements OnInit, OnDestroy {
  private readonly salesService = inject(SalesService);
  private readonly recipeService = inject(RecipeService);
  private readonly tableService = inject(RestaurantTableService);
  private readonly destroy$ = new Subject<void>();

  readonly recipes = signal<SaleableRecipe[]>([]);
  readonly recipeNameById = signal<Record<string, string>>({});
  readonly sales = signal<SaleResponse[]>([]);
  readonly currentCart = signal<CartLine[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly visibilityFilter = signal<VisibilityFilter>('ALL');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly sortMode = signal<SortMode>('NAME_ASC');
  readonly sellerName = signal('Vendedor principal');
  readonly selectedSellerId = signal('SELLER-TEST-001');
  readonly selectedLocationId = signal(ENV.locationId);
  readonly selectedTableId = signal<string | null>(null);
  readonly selectedTableLabel = signal('Selecciona una mesa');
  readonly availableTables = signal<RestaurantTable[]>([]);
  readonly tableSelectorOpen = signal(false);
  readonly loadingTables = signal(false);
  readonly loadingRecipes = signal(false);
  readonly loadingSales = signal(false);
  readonly submitting = signal(false);
  readonly recipeError = signal(false);
  readonly processingSaleIds = signal<string[]>([]);
  readonly preparationTracesBySaleId = signal<Record<string, RecipePreparationTrace[]>>({});
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error' | 'warning' | 'info'>('success');

  readonly filteredRecipes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const visibility = this.visibilityFilter();
    const minPrice = this.minPrice();
    const maxPrice = this.maxPrice();
    const sorted = this.recipes().filter(item => {
      const matchQ = !q || item.name.toLowerCase().includes(q);
      const matchStatus = status === 'ALL' || (status === 'ACTIVE' ? item.active : !item.active);
      const matchVisibility = visibility === 'ALL' || (visibility === 'VISIBLE' ? item.visibleInMenu : !item.visibleInMenu);
      const matchMin = minPrice === null || item.price >= minPrice;
      const matchMax = maxPrice === null || item.price <= maxPrice;
      return matchQ && matchStatus && matchVisibility && matchMin && matchMax;
    });
    return sorted.sort((a, b) => this.sortMode() === 'PRICE_ASC' ? a.price - b.price : this.sortMode() === 'PRICE_DESC' ? b.price - a.price : a.name.localeCompare(b.name, 'es'));
  });

  ngOnInit(): void { this.loadRecipes(); this.refreshSales(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  computeTotal(): number { return this.currentCart().reduce((acc, l) => acc + l.quantity * l.unitPrice, 0); }
  cartItemsCount(): number { return this.currentCart().reduce((acc, l) => acc + l.quantity, 0); }

  addToCart(item: SaleableRecipe): void {
    if (!item.active) return this.pushToast('warning', 'No puedes vender una receta inactiva.');
    if (!item.price || item.price <= 0) return this.pushToast('warning', 'Precio no disponible para esta receta.');
    this.currentCart.update(c => {
      const idx = c.findIndex(x => x.recipeId === item.id);
      if (idx === -1) return [...c, { recipeId: item.id, name: item.name, quantity: 1, unitPrice: item.price, recipeLineComment: 'Sin observaciones' }];
      const n = [...c]; n[idx] = { ...n[idx], quantity: n[idx].quantity + 1 }; return n;
    });
  }
  updateQuantity(recipeId: string, q: number): void { this.currentCart.update(c => c.map(x => x.recipeId === recipeId ? { ...x, quantity: Math.max(1, q || 1) } : x)); }
  removeFromCart(recipeId: string): void { this.currentCart.update(c => c.filter(x => x.recipeId !== recipeId)); }
  updateComment(recipeId: string, v: string): void { this.currentCart.update(c => c.map(x => x.recipeId === recipeId ? { ...x, recipeLineComment: (v || 'Sin observaciones').trim() || 'Sin observaciones' } : x)); }

  openTableSelector(): void {
    this.tableSelectorOpen.set(true);
    if (this.availableTables().length > 0) return;
    this.loadingTables.set(true);
    this.tableService.getTables().subscribe({
      next: tables => { this.availableTables.set(tables); this.loadingTables.set(false); },
      error: () => { this.loadingTables.set(false); this.pushToast('error', 'No se pudieron cargar las mesas.'); }
    });
  }
  closeTableSelector(): void { this.tableSelectorOpen.set(false); }
  selectTable(table: RestaurantTable): void {
    if (!this.isTableAvailable(table)) return this.pushToast('warning', 'Debes seleccionar una mesa disponible.');
    this.selectedTableId.set(table.id);
    this.selectedTableLabel.set(this.tableLabel(table));
    this.pushToast('success', 'Mesa seleccionada correctamente.');
    this.closeTableSelector();
  }

  completeSale(): void {
    const payload = this.buildPayload(); if (!payload) return;
    this.submitting.set(true);
    this.salesService.createSale(payload).subscribe({
      next: (response) => { this.submitting.set(false); this.pushToast('warning', 'Venta recibida. Se está procesando con inventario.'); this.currentCart.set([]); this.trackProcessing(response.saleId, 'create'); this.refreshSales(); },
      error: (error) => { this.submitting.set(false); this.pushToast('error', this.readError(error) || 'No se pudo crear la venta.'); }
    });
  }

  isTableAvailable(table: RestaurantTable): boolean {
    if (table.available !== undefined) return table.available;
    if (table.occupied !== undefined) return !table.occupied;
    if (table.status) return ['AVAILABLE', 'DISPONIBLE', 'FREE', 'LIBRE'].includes(table.status.toUpperCase());
    return true;
  }
  tableLabel(table: RestaurantTable): string { return table.name || (table.number ? `Mesa ${table.number}` : table.code || 'Mesa sin nombre'); }

  patchStatus(id: string, status: SaleStatus): void { if (!this.canPatchTo(this.sales().find(s => s.id === id)?.status, status)) return; this.salesService.patchSaleStatus(id, status).subscribe({ next: () => { this.pushToast('warning', 'Cambio de estado enviado a procesamiento.'); this.trackProcessing(id, 'patch'); }, error: e => this.pushToast('error', this.readError(e)) }); }
  deleteSale(sale: SaleResponse): void { if (sale.status === 'COMPLETED') return this.pushToast('warning', 'No se puede eliminar una venta completada.'); this.salesService.deleteSale(sale.id).subscribe({ next: () => { this.pushToast('warning', 'Eliminación solicitada. Se está procesando con inventario.'); this.trackProcessing(sale.id, 'delete'); }, error: e => this.pushToast('error', this.readError(e)) }); }
  refreshPreparations(saleId: string): void { this.salesService.getSalePreparations(saleId).subscribe({ next: t => { this.preparationTracesBySaleId.update(s => ({ ...s, [saleId]: t })); if (t.some(x => x.status === 'REJECTED')) this.pushToast('warning', 'Una o más recetas fueron rechazadas por inventario.'); }, error: () => {} }); }

  shortSaleCode(id: string): string { return `Venta #${id.slice(-6).toUpperCase()}`; }
  saleStatusLabel(status: SaleStatus): string { return ({ CREATED: 'Creada', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', CANCELLED: 'Cancelada' })[status]; }
  traceStatusLabel(status: 'ACCEPTED' | 'REJECTED'): string { return status === 'ACCEPTED' ? 'Aceptada' : 'Rechazada'; }
  traceRecipeName(recipeId: string): string { return this.recipeNameById()[recipeId] ?? 'Receta no encontrada'; }
  private refreshSales(): void { this.loadingSales.set(true); this.salesService.getSales().subscribe({ next: (sales) => { this.sales.set(sales ?? []); this.loadingSales.set(false); }, error: (error) => { this.loadingSales.set(false); this.pushToast('error', this.readLoadSalesError(error)); } }); }
  private loadRecipes(): void {
    this.loadingRecipes.set(true); this.recipeError.set(false);
    this.recipeService.getRecipes().subscribe({
      next: (recipes: RecipeResponse[]) => { const mapped = recipes.map(r => ({ id: r.id, name: r.name, price: r.sellingPrice, active: r.active, visibleInMenu: r.visibleInMenu })); this.recipes.set(mapped); this.recipeNameById.set(recipes.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {})); this.loadingRecipes.set(false); },
      error: () => { this.loadingRecipes.set(false); this.recipeError.set(true); this.pushToast('error', 'No se pudieron cargar las recetas.'); }
    });
  }

  private buildPayload(): SaleRequest | null {
    if (!this.selectedSellerId() || !this.selectedLocationId()) return this.pushToast('error', 'Vendedor y sede son obligatorios.'), null;
    if (!this.selectedTableId()) return this.pushToast('warning', 'Debes seleccionar una mesa disponible.'), null;
    if (this.currentCart().length === 0) return this.pushToast('error', 'Agrega recetas para iniciar una venta.'), null;
    return { sellerId: this.selectedSellerId(), locationId: this.selectedLocationId(), tableId: this.selectedTableId()!, details: this.currentCart().map(l => ({ recipeId: l.recipeId, quantity: l.quantity, unitPrice: l.unitPrice, recipeLineComment: l.recipeLineComment || 'Sin observaciones', lineDisplayName: l.name })) };
  }

  private trackProcessing(saleId: string, mode: 'create' | 'patch' | 'delete'): void { this.processingSaleIds.update(ids => ids.includes(saleId) ? ids : [...ids, saleId]); const startedAt = Date.now(); interval(3000).pipe(takeUntil(this.destroy$), switchMap(() => this.salesService.getSaleById(saleId).pipe(catchError((e: HttpErrorResponse) => of(e)))), tap((result) => { const timeout = Date.now() - startedAt > 60000; if (result instanceof HttpErrorResponse && result.status === 404 && !timeout) return; if (timeout) { this.pushToast('warning', `La ${mode === 'delete' ? 'eliminación' : 'venta'} sigue en procesamiento.`); this.stopTracking(saleId); return; } if (result instanceof HttpErrorResponse) { this.pushToast('error', this.readError(result)); this.stopTracking(saleId); return; } if (mode !== 'delete') { this.refreshSales(); this.refreshPreparations(saleId); } this.stopTracking(saleId); }))
      .subscribe(); }

  canPatchTo(current: SaleStatus | undefined, target: SaleStatus): boolean { if (!current) return false; if (current === 'CREATED') return target === 'IN_PROGRESS' || target === 'CANCELLED'; if (current === 'IN_PROGRESS') return target === 'COMPLETED' || target === 'CANCELLED'; return false; }
  isProcessing(saleId: string): boolean { return this.processingSaleIds().includes(saleId); }
  tracesBySaleId(saleId: string): RecipePreparationTrace[] { return this.preparationTracesBySaleId()[saleId] ?? []; }
  private stopTracking(saleId: string): void { this.processingSaleIds.update(ids => ids.filter(id => id !== saleId)); }
  private pushToast(type: 'success' | 'error' | 'warning' | 'info', message: string): void { this.toastType.set(type); this.toastMessage.set(message); setTimeout(() => this.toastMessage.set(''), 4500); }
  private readLoadSalesError(error: unknown): string { const err = error as HttpErrorResponse; if (err.status === 0) return 'No se pudo conectar con el servidor.'; if (err.status === 401) return 'Sesión expirada. Inicia sesión nuevamente.'; return 'No se pudieron cargar las ventas.'; }
  private readError(error: unknown): string { const err = error as HttpErrorResponse; return err.error?.message ?? 'No se pudo crear la venta.'; }
}
