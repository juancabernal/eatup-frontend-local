import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, catchError, finalize, forkJoin, interval, switchMap, take, timer } from 'rxjs';
import { CartItem, RecipePreparationTrace, RecipeResponse, RestaurantTable, SaleResponse, SaleStatus, Seller } from '../../models/sales.model';
import { RecipeService } from '../../services/recipe.service';
import { SalesService } from '../../services/sales.service';
import { SellerTableService } from '../../services/seller-table.service';
import { EnvironmentService } from '../../../../../core/services/environment.service';

type ToastType = 'success' | 'error';
type ToastMessage = { id: string; type: ToastType; message: string; duration: number };

@Component({
  selector: 'app-sales-page', standalone: true, imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './sales-page.component.html', styleUrl: './sales-page.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesPageComponent implements OnInit {
  recipes: RecipeResponse[] = []; sales: SaleResponse[] = []; filteredSales: SaleResponse[] = []; cartItems: CartItem[] = []; tracesBySaleId: Record<string, RecipePreparationTrace[]> = {};
  sellers: Seller[] = []; tables: RestaurantTable[] = []; sellerQuery = ''; tableQuery = '';

  recipeSearchTerm = '';
  recipeStatusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  recipeVisibilityFilter: 'ALL' | 'VISIBLE' | 'HIDDEN' = 'ALL';
  recipeMinPrice: number | null = null;
  recipeMaxPrice: number | null = null;
  recipeSort: 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC' = 'NAME_ASC';

  saleSearchTerm = '';
  saleStatusFilter: 'ALL' | SaleStatus = 'ALL';
  saleDateFrom: string | null = null;
  saleDateTo: string | null = null;
  saleMinTotal: number | null = null;
  saleMaxTotal: number | null = null;
  selectedSellerId = ''; selectedSellerName = ''; selectedTableId = ''; selectedTableName = '';
  showCommentModal = false; showSellerModal = false; showTableModal = false; showDeleteModal = false;
  showUpdateModal = false;
  showTraceModal = false; traceLoading = false; selectedTraceSaleId = '';
  selectedCartRecipeId = ''; modalComment = 'Sin observaciones'; deletingSaleId = ''; loading = false;
  selectedSaleToUpdate: SaleResponse | null = null;
  updateDraft: { sellerId: string; sellerName: string; tableId: string; tableName: string; locationId: string; details: CartItem[]; } | null = null;
  isUpdatingSaleId: string | null = null;
  toasts: ToastMessage[] = [];
  isCreatingSale = false;
  salesPage = 1; salesPageSize = 5; salesPageSizeOptions = [5, 10, 20];
  private salesPollingStarted = false;
  private salesInitialLoadCompleted = false;
  private lastSalesErrorToastAt = 0;

  constructor(private salesService: SalesService, private recipeService: RecipeService, private sellerTableService: SellerTableService, private cdr: ChangeDetectorRef, public env: EnvironmentService) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll() {
    this.loading = true;
    forkJoin([this.recipeService.getRecipes(), this.salesService.getSales(), this.sellerTableService.getSellers(), this.sellerTableService.getTables()])
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: ([r, s, se, t]) => {
          this.recipes = [...r];
          this.sales = this.normalizeAndSortSales(s);
          this.applySaleFilters(false);
          this.sellers = [...se];
          this.tables = [...t];
          if (!this.salesPollingStarted) this.startSalesPolling();
        },
        error: () => this.showToast('error', 'No se pudieron cargar los datos de ventas.')
      });
  }

  get filteredRecipes() { return this.getFilteredRecipes(); }
  get filteredSellers() { return this.sellers.filter(s => this.sellerDisplayName(s).toLowerCase().includes(this.sellerQuery.toLowerCase()) || (s.document ?? '').toLowerCase().includes(this.sellerQuery.toLowerCase())); }
  get filteredTables() { return this.tables.filter(t => this.tableDisplayName(t).toLowerCase().includes(this.tableQuery.toLowerCase())); }

  addToCart(recipe: RecipeResponse) {
    if (!recipe.active || recipe.sellingPrice <= 0) return;
    const i = this.cartItems.find(x => x.recipeId === recipe.id);
    this.cartItems = i ? this.cartItems.map(x => x.recipeId === recipe.id ? { ...x, quantity: x.quantity + 1 } : x) : [...this.cartItems, { recipeId: recipe.id, recipeName: recipe.name, lineDisplayName: recipe.name, quantity: 1, unitPrice: recipe.sellingPrice, recipeLineComment: 'Sin observaciones' }];
    this.cdr.markForCheck();
  }
  updateQty(id: string, qty: number) { const q = Math.max(1, qty || 1); this.cartItems = this.cartItems.map(x => x.recipeId === id ? { ...x, quantity: q } : x); this.cdr.markForCheck(); }
  removeItem(id: string) { this.cartItems = this.cartItems.filter(x => x.recipeId !== id); this.cdr.markForCheck(); }
  openComment(item: CartItem) { this.selectedCartRecipeId = item.recipeId; this.modalComment = item.recipeLineComment || 'Sin observaciones'; this.showCommentModal = true; }
  saveComment() { const c = this.modalComment.trim() || 'Sin observaciones'; this.cartItems = this.cartItems.map(x => x.recipeId === this.selectedCartRecipeId ? { ...x, recipeLineComment: c } : x); this.showCommentModal = false; this.cdr.markForCheck(); }
  get total() { return this.cartItems.reduce((a, b) => a + b.quantity * b.unitPrice, 0); }

  completeSale() {
    if (this.isCreatingSale) return;
    if (!this.selectedSellerId) return this.showToast('error', 'Debes seleccionar un vendedor.');
    if (!this.selectedTableId) return this.showToast('error', 'Debes seleccionar una mesa disponible.');
    if (!this.cartItems.length) return this.showToast('error', 'Agrega al menos una receta a la venta.');

    if (this.cartItems.some(i => !i.recipeId || i.quantity <= 0 || i.unitPrice <= 0)) return this.showToast('error', 'La cantidad debe ser mayor que cero.');

    const payload = { sellerId: this.selectedSellerId, locationId: (window as any).ENV?.LOCATION_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', tableId: this.selectedTableId, details: this.cartItems.map(i => ({ recipeId: i.recipeId, quantity: i.quantity, unitPrice: i.unitPrice, recipeLineComment: i.recipeLineComment?.trim() || 'Sin observaciones', lineDisplayName: i.lineDisplayName || i.recipeName })) };
    this.isCreatingSale = true;
    this.cdr.markForCheck();
    this.salesService.createSale(payload)
      .pipe(finalize(() => { this.isCreatingSale = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res) => {
          const message = res?.message || 'Venta enviada a procesamiento correctamente.';
          this.showToast('success', message);
          this.clearCurrentOrder();
          this.refreshSales(true);
          if (res?.saleId) interval(2500).pipe(take(4), switchMap(() => this.salesService.getSaleById(res.saleId))).subscribe({ next: () => this.refreshSales(true), error: () => {} });
        },
        error: () => this.showToast('error', 'No se pudo crear la venta.')
      });
  }

  get totalSalesPages() { return Math.max(1, Math.ceil(this.filteredSales.length / this.salesPageSize)); }
  get paginatedSales() { const start = (this.salesPage - 1) * this.salesPageSize; return this.filteredSales.slice(start, start + this.salesPageSize); }
  get salesRangeStart() { return this.filteredSales.length ? (this.salesPage - 1) * this.salesPageSize + 1 : 0; }
  get salesRangeEnd() { return Math.min(this.salesPage * this.salesPageSize, this.filteredSales.length); }
  changeSalesPageSize(size: number) { this.salesPageSize = Number(size); this.salesPage = 1; this.ensureValidSalesPage(); this.cdr.markForCheck(); }
  prevSalesPage() { if (this.salesPage > 1) { this.salesPage -= 1; this.cdr.markForCheck(); } }
  nextSalesPage() { if (this.salesPage < this.totalSalesPages) { this.salesPage += 1; this.cdr.markForCheck(); } }

  refreshSales(silent = false) {
    this.salesService.getSales().subscribe({
      next: s => { this.sales = this.normalizeAndSortSales(s); this.applySaleFilters(false); this.cdr.markForCheck(); },
      error: () => { if (!silent) this.showToast('error', 'No se pudieron refrescar las ventas.'); }
    });
  }
  changeStatus(id: string, status: SaleStatus) { this.salesService.patchSaleStatus(id, status).subscribe({ next: () => { this.showToast('success', 'Actualización enviada a procesamiento.'); this.refreshSales(); }, error: () => this.showToast('error', 'No se pudo actualizar el estado.') }); }
  askDelete(id: string) { this.deletingSaleId = id; this.showDeleteModal = true; }
  deleteSale() {
    const target = this.sales.find(s => s.id === this.deletingSaleId);
    if (target?.status === 'COMPLETED') {
      this.showDeleteModal = false;
      this.showToast('error', 'No se puede eliminar una venta completada.');
      this.cdr.markForCheck();
      return;
    }
    this.salesService.deleteSale(this.deletingSaleId).subscribe({ next: () => { this.showDeleteModal = false; this.showToast('success', 'Eliminación enviada a procesamiento.'); this.refreshSales(); }, error: () => this.showToast('error', 'No se pudo eliminar la venta.') });
  }
  openTraceModal(saleId: string) { this.selectedTraceSaleId = saleId; this.showTraceModal = true; this.traceLoading = true; this.cdr.markForCheck(); this.loadTrace(saleId, true); }
  closeTraceModal() { this.showTraceModal = false; this.selectedTraceSaleId = ''; this.traceLoading = false; this.cdr.markForCheck(); }
  loadTrace(id: string, refresh = true) {
    if (!refresh && this.tracesBySaleId[id]) { this.traceLoading = false; this.cdr.markForCheck(); return; }
    this.salesService.getSalePreparations(id).subscribe({
      next: t => { this.tracesBySaleId = { ...this.tracesBySaleId, [id]: [...t] }; this.traceLoading = false; this.cdr.markForCheck(); },
      error: () => { this.traceLoading = false; this.showToast('error', 'No se pudo cargar la trazabilidad.'); this.cdr.markForCheck(); }
    });
  }
  pickSeller(s: Seller) { this.selectedSellerId = s.id; this.selectedSellerName = this.sellerDisplayName(s); this.showSellerModal = false; }

  tableAvailable(t: RestaurantTable) { const s = (t.status || '').toUpperCase(); if (t.available === true || t.canOpenNow === true || t.reserved === false || t.occupied === false || ['AVAILABLE', 'DISPONIBLE', 'FREE', 'LIBRE', 'ACTIVE'].includes(s)) return true; if (t.available === false || t.canOpenNow === false || t.reserved === true || t.occupied === true || ['OCCUPIED', 'OCUPADA', 'BUSY', 'IN_USE', 'INACTIVE'].includes(s)) return false; return false; }
  pickTable(t: RestaurantTable) { if (!this.tableAvailable(t)) return; this.selectedTableId = t.id; this.selectedTableName = this.tableDisplayName(t); this.showTableModal = false; }
  openUpdateSaleModal(sale: SaleResponse) {
    if (sale.status === 'CREATED') return;
    const sellerName = this.sellers.find(s => s.id === sale.sellerId);
    const tableName = this.tables.find(t => t.id === sale.tableId);
    this.selectedSaleToUpdate = sale;
    this.updateDraft = {
      sellerId: sale.sellerId,
      sellerName: sellerName ? this.sellerDisplayName(sellerName) : 'Vendedor sin nombre',
      tableId: sale.tableId,
      tableName: tableName ? this.tableDisplayName(tableName) : 'Mesa sin nombre',
      locationId: sale.locationId || ((window as any).ENV?.LOCATION_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
      details: sale.details.map(detail => ({ recipeId: detail.recipeId, recipeName: detail.lineDisplayName || this.recipeNameById(detail.recipeId), lineDisplayName: detail.lineDisplayName || this.recipeNameById(detail.recipeId), quantity: detail.quantity, unitPrice: detail.unitPrice, recipeLineComment: detail.recipeLineComment || 'Sin observaciones' }))
    };
    this.showUpdateModal = true;
    this.cdr.markForCheck();
  }
  closeUpdateSaleModal() { this.showUpdateModal = false; this.selectedSaleToUpdate = null; this.updateDraft = null; this.cdr.markForCheck(); }
  updateDraftQty(recipeId: string, qty: number) { if (!this.updateDraft) return; const q = Math.max(1, Number(qty) || 1); this.updateDraft = { ...this.updateDraft, details: this.updateDraft.details.map(i => i.recipeId === recipeId ? { ...i, quantity: q } : i) }; this.cdr.markForCheck(); }
  updateDraftUnitPrice(recipeId: string, unitPrice: number) { if (!this.updateDraft) return; const p = Math.max(1, Number(unitPrice) || 1); this.updateDraft = { ...this.updateDraft, details: this.updateDraft.details.map(i => i.recipeId === recipeId ? { ...i, unitPrice: p } : i) }; this.cdr.markForCheck(); }
  updateDraftComment(recipeId: string, value: string) { if (!this.updateDraft) return; this.updateDraft = { ...this.updateDraft, details: this.updateDraft.details.map(i => i.recipeId === recipeId ? { ...i, recipeLineComment: value } : i) }; this.cdr.markForCheck(); }
  removeUpdateDraftItem(recipeId: string) { if (!this.updateDraft) return; this.updateDraft = { ...this.updateDraft, details: this.updateDraft.details.filter(i => i.recipeId !== recipeId) }; this.cdr.markForCheck(); }
  updateDraftTotal() { return (this.updateDraft?.details ?? []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0); }
  submitSaleUpdate() {
    if (!this.selectedSaleToUpdate || !this.updateDraft || this.isUpdatingSaleId) return;
    if (!this.validateUpdateDraft()) return;
    const payload = { sellerId: this.updateDraft.sellerId, locationId: this.updateDraft.locationId, tableId: this.updateDraft.tableId, details: this.updateDraft.details.map(item => ({ recipeId: item.recipeId, quantity: item.quantity, unitPrice: item.unitPrice, recipeLineComment: item.recipeLineComment?.trim() || 'Sin observaciones', lineDisplayName: item.lineDisplayName || item.recipeName })) };
    this.isUpdatingSaleId = this.selectedSaleToUpdate.id;
    this.cdr.markForCheck();
    this.salesService.updateSale(this.selectedSaleToUpdate.id, payload)
      .pipe(finalize(() => { this.isUpdatingSaleId = null; this.cdr.markForCheck(); }))
      .subscribe({
        next: (response) => {
          this.showToast('success', response?.message || 'Actualización enviada a procesamiento correctamente.');
          this.closeUpdateSaleModal();
          this.refreshSales(true);
        },
        error: () => this.showToast('error', 'No se pudo actualizar la venta.')
      });
  }
  saleLabel(id: string) { return `#${id.slice(-6).toUpperCase()}`; }
  recipeNameById(id: string) { return this.recipes.find(r => r.id === id)?.name ?? 'Receta no encontrada'; }
  sellerDisplayName(s: Seller) { return s.fullName || s.name || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.email || s.identificationNumber || (s as any).identification_number || s.phone || 'Vendedor sin nombre'; }
  tableDisplayName(t: RestaurantTable) { const num = t.number ?? t.tableNumber; return t.displayName || t.name || t.tableName || (num ? `Mesa ${num}` : t.code) || 'Mesa sin nombre'; }
  saleStatusLabel(status: SaleStatus) { return ({ CREATED: 'Creada', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', CANCELLED: 'Cancelada' })[status] || status; }
  traceStatusLabel(status: string) { return status === 'ACCEPTED' ? 'Aceptada' : 'Rechazada'; }
  trackBySaleId(_: number, sale: SaleResponse) { return sale.id; }
  traceRecipeName(trace: RecipePreparationTrace) {
    const fromCatalog = this.recipes.find(r => r.id === trace.recipeId)?.name;
    if (fromCatalog) return fromCatalog;
    const selectedSale = this.sales.find(s => s.id === this.selectedTraceSaleId);
    const fromSaleLine = selectedSale?.details?.find(d => d.recipeId === trace.recipeId)?.lineDisplayName;
    return fromSaleLine || 'Receta no encontrada';
  }
  activeTraceSaleLabel() { return this.selectedTraceSaleId ? this.saleLabel(this.selectedTraceSaleId) : ''; }
  activeTraceItems() { return this.selectedTraceSaleId ? (this.tracesBySaleId[this.selectedTraceSaleId] ?? []) : []; }
  commentRecipeName() { return this.cartItems.find(i => i.recipeId === this.selectedCartRecipeId)?.recipeName || 'receta'; }
  showToast(type: ToastType, message: string, duration = 4500) {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const toast: ToastMessage = { id, type, message, duration };
    this.toasts = [...this.toasts, toast];
    window.setTimeout(() => this.removeToast(toast.id), toast.duration);
    this.cdr.markForCheck();
  }

  trackByToastId(_: number, toast: ToastMessage) { return toast.id; }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.markForCheck();
  }


  applyRecipeFilters() { this.cdr.markForCheck(); }

  clearRecipeFilters() {
    this.recipeSearchTerm = '';
    this.recipeStatusFilter = 'ALL';
    this.recipeVisibilityFilter = 'ALL';
    this.recipeMinPrice = null;
    this.recipeMaxPrice = null;
    this.recipeSort = 'NAME_ASC';
    this.cdr.markForCheck();
  }

  applySaleFilters(resetPage = true) {
    const term = this.saleSearchTerm.trim().toLowerCase();
    const fromDate = this.saleDateFrom ? new Date(`${this.saleDateFrom}T00:00:00`).getTime() : null;
    const toDate = this.saleDateTo ? new Date(`${this.saleDateTo}T23:59:59.999`).getTime() : null;
    this.filteredSales = this.sales.filter(sale => {
      const saleCode = this.saleLabel(sale.id).replace('#', '').toLowerCase();
      const saleDate = new Date(sale.createdDate || sale.modifiedDate || 0).getTime();
      const total = sale.totalAmount || 0;
      if (term && !saleCode.includes(term)) return false;
      if (this.saleStatusFilter !== 'ALL' && sale.status !== this.saleStatusFilter) return false;
      if (fromDate && saleDate < fromDate) return false;
      if (toDate && saleDate > toDate) return false;
      if (this.saleMinTotal !== null && total < this.saleMinTotal) return false;
      if (this.saleMaxTotal !== null && total > this.saleMaxTotal) return false;
      return true;
    });
    if (resetPage) this.salesPage = 1;
    this.ensureValidSalesPage();
    this.cdr.markForCheck();
  }

  clearSaleFilters() {
    this.saleSearchTerm = '';
    this.saleStatusFilter = 'ALL';
    this.saleDateFrom = null;
    this.saleDateTo = null;
    this.saleMinTotal = null;
    this.saleMaxTotal = null;
    this.applySaleFilters();
  }
  private validateUpdateDraft() {
    if (!this.updateDraft?.sellerId) { this.showToast('error', 'Debes seleccionar un vendedor.'); return false; }
    if (!this.updateDraft?.tableId) { this.showToast('error', 'Debes seleccionar una mesa disponible.'); return false; }
    if (!this.updateDraft.details.length) { this.showToast('error', 'La venta debe tener al menos una receta.'); return false; }
    if (this.updateDraft.details.some(item => item.quantity <= 0)) { this.showToast('error', 'La cantidad debe ser mayor que cero.'); return false; }
    if (this.updateDraft.details.some(item => item.unitPrice <= 0)) { this.showToast('error', 'El precio unitario debe ser mayor que cero.'); return false; }
    return true;
  }


  private clearCurrentOrder() {
    this.cartItems = [];
    this.selectedCartRecipeId = '';
    this.modalComment = 'Sin observaciones';
    this.cdr.markForCheck();
  }

  private getFilteredRecipes() {
    const term = this.recipeSearchTerm.trim().toLowerCase();
    const minPrice = this.recipeMinPrice ?? null;
    const maxPrice = this.recipeMaxPrice ?? null;
    return [...this.recipes].filter(recipe => {
      const name = (recipe.name || '').toLowerCase();
      const price = recipe.sellingPrice || 0;
      if (term && !name.includes(term)) return false;
      if (this.recipeStatusFilter === 'ACTIVE' && !recipe.active) return false;
      if (this.recipeStatusFilter === 'INACTIVE' && recipe.active) return false;
      if (this.recipeVisibilityFilter === 'VISIBLE' && !recipe.visibleInMenu) return false;
      if (this.recipeVisibilityFilter === 'HIDDEN' && recipe.visibleInMenu) return false;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    }).sort((a, b) => {
      if (this.recipeSort === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (this.recipeSort === 'PRICE_ASC') return (a.sellingPrice || 0) - (b.sellingPrice || 0);
      if (this.recipeSort === 'PRICE_DESC') return (b.sellingPrice || 0) - (a.sellingPrice || 0);
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private normalizeAndSortSales(sales: SaleResponse[]) {
    return [...sales].sort((a, b) => {
      const dA = new Date(a.modifiedDate || a.createdDate || 0).getTime();
      const dB = new Date(b.modifiedDate || b.createdDate || 0).getTime();
      return dB - dA;
    });
  }

  private ensureValidSalesPage() {
    const maxPage = this.totalSalesPages;
    if (this.salesPage > maxPage) this.salesPage = maxPage;
    if (this.salesPage < 1) this.salesPage = 1;
  }

  private startSalesPolling() {
    this.salesPollingStarted = true;
    timer(0, 10000).pipe(
      switchMap(() => this.salesService.getSales().pipe(
        catchError(() => {
          const now = Date.now();
          if (!this.salesInitialLoadCompleted || now - this.lastSalesErrorToastAt > 45000) {
            this.lastSalesErrorToastAt = now;
            this.showToast('error', 'No se pudieron refrescar las ventas.');
          }
          return EMPTY;
        })
      ))
    ).subscribe(s => {
      this.sales = this.normalizeAndSortSales(s);
      this.applySaleFilters(false);
      this.salesInitialLoadCompleted = true;
      this.cdr.markForCheck();
    });
  }
}
