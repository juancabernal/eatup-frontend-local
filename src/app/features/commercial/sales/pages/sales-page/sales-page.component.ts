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
  recipes: RecipeResponse[] = []; sales: SaleResponse[] = []; cartItems: CartItem[] = []; tracesBySaleId: Record<string, RecipePreparationTrace[]> = {};
  sellers: Seller[] = []; tables: RestaurantTable[] = []; recipeQuery = ''; sellerQuery = ''; tableQuery = '';
  selectedSellerId = ''; selectedSellerName = ''; selectedTableId = ''; selectedTableName = '';
  showCommentModal = false; showSellerModal = false; showTableModal = false; showDeleteModal = false;
  showTraceModal = false; traceLoading = false; selectedTraceSaleId = '';
  selectedCartRecipeId = ''; modalComment = 'Sin observaciones'; deletingSaleId = ''; loading = false;
  toasts: ToastMessage[] = [];
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
          this.sellers = [...se];
          this.tables = [...t];
          this.ensureValidSalesPage();
          if (!this.salesPollingStarted) this.startSalesPolling();
        },
        error: () => this.showToast('error', 'No se pudieron cargar los datos de ventas.')
      });
  }

  get filteredRecipes() { return this.recipes.filter(r => r.name?.toLowerCase().includes(this.recipeQuery.toLowerCase())); }
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
    if (!this.selectedSellerId) return this.showToast('error', 'Debes seleccionar un vendedor.');
    if (!this.selectedTableId) return this.showToast('error', 'Debes seleccionar una mesa disponible.');
    if (!this.cartItems.length) return this.showToast('error', 'Agrega al menos una receta a la venta.');

    if (this.cartItems.some(i => !i.recipeId || i.quantity <= 0 || i.unitPrice <= 0)) return this.showToast('error', 'La cantidad debe ser mayor que cero.');

    const payload = { sellerId: this.selectedSellerId, locationId: (window as any).ENV?.LOCATION_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', tableId: this.selectedTableId, details: this.cartItems.map(i => ({ recipeId: i.recipeId, quantity: i.quantity, unitPrice: i.unitPrice, recipeLineComment: i.recipeLineComment?.trim() || 'Sin observaciones', lineDisplayName: i.lineDisplayName || i.recipeName })) };
    this.salesService.createSale(payload).subscribe({
      next: (res) => {
        this.showToast('success', 'Venta recibida. Se está procesando con inventario.');
        this.cartItems = []; this.cdr.markForCheck(); this.refreshSales();
        if (res.saleId) interval(2500).pipe(take(4), switchMap(() => this.salesService.getSaleById(res.saleId))).subscribe({ next: () => this.refreshSales(), error: () => {} });
      },
      error: () => this.showToast('error', 'No se pudo crear la venta.')
    });
  }

  get totalSalesPages() { return Math.max(1, Math.ceil(this.sales.length / this.salesPageSize)); }
  get paginatedSales() { const start = (this.salesPage - 1) * this.salesPageSize; return this.sales.slice(start, start + this.salesPageSize); }
  get salesRangeStart() { return this.sales.length ? (this.salesPage - 1) * this.salesPageSize + 1 : 0; }
  get salesRangeEnd() { return Math.min(this.salesPage * this.salesPageSize, this.sales.length); }
  changeSalesPageSize(size: number) { this.salesPageSize = Number(size); this.salesPage = 1; this.ensureValidSalesPage(); this.cdr.markForCheck(); }
  prevSalesPage() { if (this.salesPage > 1) { this.salesPage -= 1; this.cdr.markForCheck(); } }
  nextSalesPage() { if (this.salesPage < this.totalSalesPages) { this.salesPage += 1; this.cdr.markForCheck(); } }

  refreshSales(silent = false) {
    this.salesService.getSales().subscribe({
      next: s => { this.sales = this.normalizeAndSortSales(s); this.ensureValidSalesPage(); this.cdr.markForCheck(); },
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
  showToast(type: ToastType, message: string) {
    const toast: ToastMessage = { id: crypto.randomUUID(), type, message, duration: 4500 };
    this.toasts = [...this.toasts, toast];
    window.setTimeout(() => this.removeToast(toast.id), toast.duration);
    this.cdr.markForCheck();
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.markForCheck();
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
      this.ensureValidSalesPage();
      this.salesInitialLoadCompleted = true;
      this.cdr.markForCheck();
    });
  }
}
