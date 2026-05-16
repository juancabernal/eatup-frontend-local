import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, interval, switchMap, take } from 'rxjs';
import { CartItem, RecipePreparationTrace, RecipeResponse, RestaurantTable, SaleResponse, SaleStatus, Seller } from '../../models/sales.model';
import { RecipeService } from '../../services/recipe.service';
import { SalesService } from '../../services/sales.service';
import { SellerTableService } from '../../services/seller-table.service';
import { EnvironmentService } from '../../../../../core/services/environment.service';

type ToastType = 'success' | 'error';

@Component({
  selector: 'app-sales-page', standalone: true, imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './sales-page.component.html', styleUrl: './sales-page.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesPageComponent implements OnInit {
  recipes: RecipeResponse[] = []; sales: SaleResponse[] = []; cartItems: CartItem[] = []; tracesBySaleId: Record<string, RecipePreparationTrace[]> = {};
  sellers: Seller[] = []; tables: RestaurantTable[] = []; recipeQuery = ''; sellerQuery = ''; tableQuery = '';
  selectedSellerId = ''; selectedSellerName = ''; selectedTableId = ''; selectedTableName = '';
  showCommentModal = false; showSellerModal = false; showTableModal = false; showDeleteModal = false;
  selectedCartRecipeId = ''; modalComment = 'Sin observaciones'; deletingSaleId = ''; loading = false;
  toast: { id: number; type: ToastType; message: string } | null = null;

  constructor(private salesService: SalesService, private recipeService: RecipeService, private sellerTableService: SellerTableService, private cdr: ChangeDetectorRef, public env: EnvironmentService) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll() {
    this.loading = true;
    forkJoin([this.recipeService.getRecipes(), this.salesService.getSales(), this.sellerTableService.getSellers(), this.sellerTableService.getTables()])
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: ([r, s, se, t]) => { this.recipes = [...r]; this.sales = [...s]; this.sellers = [...se]; this.tables = [...t]; },
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
  updateQty(id: string, qty: number) { const q = Math.max(1, qty || 1); this.cartItems = this.cartItems.map(x => x.recipeId === id ? { ...x, quantity: q } : x); }
  removeItem(id: string) { this.cartItems = this.cartItems.filter(x => x.recipeId !== id); }
  openComment(item: CartItem) { this.selectedCartRecipeId = item.recipeId; this.modalComment = item.recipeLineComment || 'Sin observaciones'; this.showCommentModal = true; }
  saveComment() { const c = this.modalComment.trim() || 'Sin observaciones'; this.cartItems = this.cartItems.map(x => x.recipeId === this.selectedCartRecipeId ? { ...x, recipeLineComment: c } : x); this.showCommentModal = false; }
  get total() { return this.cartItems.reduce((a, b) => a + b.quantity * b.unitPrice, 0); }

  completeSale() {
    if (!this.selectedSellerId) return this.showToast('error', 'Debes seleccionar un vendedor.');
    if (!this.selectedTableId) return this.showToast('error', 'Debes seleccionar una mesa disponible.');
    if (!this.cartItems.length) return this.showToast('error', 'Agrega al menos una receta a la venta.');

    const payload = { sellerId: this.selectedSellerId, locationId: (window as any).ENV?.LOCATION_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', tableId: this.selectedTableId, details: this.cartItems.map(i => ({ recipeId: i.recipeId, quantity: i.quantity, unitPrice: i.unitPrice, recipeLineComment: i.recipeLineComment || 'Sin observaciones', lineDisplayName: i.lineDisplayName })) };
    this.salesService.createSale(payload).subscribe({
      next: (res) => {
        this.showToast('success', 'Venta recibida. Se está procesando con inventario.');
        this.cartItems = []; this.refreshSales();
        if (res.saleId) interval(2500).pipe(take(4), switchMap(() => this.salesService.getSaleById(res.saleId))).subscribe({ next: () => this.refreshSales(), error: () => {} });
      },
      error: () => this.showToast('error', 'No se pudo crear la venta.')
    });
  }

  refreshSales() { this.salesService.getSales().subscribe({ next: s => { this.sales = [...s]; this.cdr.markForCheck(); }, error: () => this.showToast('error', 'No se pudieron refrescar las ventas.') }); }
  changeStatus(id: string, status: SaleStatus) { this.salesService.patchSaleStatus(id, status).subscribe({ next: () => { this.showToast('success', 'Actualización enviada a procesamiento.'); this.refreshSales(); }, error: () => this.showToast('error', 'No se pudo actualizar el estado.') }); }
  askDelete(id: string) { this.deletingSaleId = id; this.showDeleteModal = true; }
  deleteSale() { this.salesService.deleteSale(this.deletingSaleId).subscribe({ next: () => { this.showDeleteModal = false; this.showToast('success', 'Eliminación enviada a procesamiento.'); this.refreshSales(); }, error: () => this.showToast('error', 'No se pudo eliminar la venta.') }); }
  loadTrace(id: string) { this.salesService.getSalePreparations(id).subscribe({ next: t => { this.tracesBySaleId = { ...this.tracesBySaleId, [id]: [...t] }; this.cdr.markForCheck(); }, error: () => this.showToast('error', 'No se pudo cargar la trazabilidad.') }); }
  pickSeller(s: Seller) { this.selectedSellerId = s.id; this.selectedSellerName = this.sellerDisplayName(s); this.showSellerModal = false; }

  tableAvailable(t: RestaurantTable) { const s = (t.status || '').toUpperCase(); if (t.available === true || t.occupied === false || ['AVAILABLE', 'DISPONIBLE', 'FREE', 'LIBRE'].includes(s)) return true; if (t.available === false || t.occupied === true || ['OCCUPIED', 'OCUPADA', 'BUSY', 'IN_USE'].includes(s)) return false; return false; }
  pickTable(t: RestaurantTable) { if (!this.tableAvailable(t)) return; this.selectedTableId = t.id; this.selectedTableName = this.tableDisplayName(t); this.showTableModal = false; }
  saleLabel(id: string) { return `#${id.slice(-6).toUpperCase()}`; }
  recipeNameById(id: string) { return this.recipes.find(r => r.id === id)?.name ?? 'Receta no encontrada'; }
  sellerDisplayName(s: Seller) { return s.fullName || s.name || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Vendedor'; }
  tableDisplayName(t: RestaurantTable) { return t.displayName || t.name || (t.number ? `Mesa ${t.number}` : t.code) || 'Mesa sin nombre'; }
  saleStatusLabel(status: SaleStatus) { return ({ CREATED: 'Creada', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', CANCELLED: 'Cancelada' })[status] || status; }
  traceStatusLabel(status: string) { return status === 'ACCEPTED' ? 'Aceptada' : 'Rechazada'; }
  commentRecipeName() { return this.cartItems.find(i => i.recipeId === this.selectedCartRecipeId)?.recipeName || 'receta'; }
  showToast(type: ToastType, message: string) { const id = Date.now(); this.toast = { id, type, message }; this.cdr.markForCheck(); setTimeout(() => { if (this.toast?.id === id) { this.toast = null; this.cdr.markForCheck(); } }, 4500); }
  closeToast() { this.toast = null; }
}
