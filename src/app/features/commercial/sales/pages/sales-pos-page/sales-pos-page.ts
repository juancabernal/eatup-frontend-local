import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, of, Subject, switchMap, takeUntil, catchError, tap } from 'rxjs';
import { SalesService } from '@commercial/sales/services/sales.service';
import { ENV } from '@config/env.config';
import { RecipePreparationTrace, SaleRequest, SaleResponse, SaleStatus, SaleableItem } from '@commercial/sales/models/sale.model';

interface CartLine { recipeId: string; name: string; quantity: number; unitPrice: number; recipeLineComment: string; }

@Component({
  selector: 'app-sales-pos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-pos-page.html',
  styleUrl: './sales-pos-page.css'
})
export class SalesPosPage implements OnInit, OnDestroy {
  private readonly salesService = inject(SalesService);
  private readonly destroy$ = new Subject<void>();

  readonly saleableItems = signal<SaleableItem[]>([]);
  readonly sales = signal<SaleResponse[]>([]);
  readonly currentCart = signal<CartLine[]>([]);
  readonly searchQuery = signal('');
  readonly selectedSellerId = signal('SELLER-TEST-001');
  readonly selectedLocationId = signal(ENV.locationId);
  readonly selectedTableId = signal('TABLE-1');
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly processingSaleIds = signal<string[]>([]);
  readonly preparationTracesBySaleId = signal<Record<string, RecipePreparationTrace[]>>({});
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error' | 'warning'>('success');

  ngOnInit(): void { this.loadSaleableItems(); this.refreshSales(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  get filteredItems(): SaleableItem[] { const q=this.searchQuery().toLowerCase().trim(); return this.saleableItems().filter(i=> i.name.toLowerCase().includes(q)); }
  computeTotal(): number { return this.currentCart().reduce((acc, l)=>acc + l.quantity*l.unitPrice,0); }

  addToCart(item: SaleableItem): void { this.currentCart.update(c=>{ const idx=c.findIndex(x=>x.recipeId===item.id); if(idx===-1) return [...c,{recipeId:item.id,name:item.name,quantity:1,unitPrice:item.price,recipeLineComment:'Sin observaciones'}]; const n=[...c]; n[idx]={...n[idx],quantity:n[idx].quantity+1}; return n;}); }
  updateQuantity(recipeId:string,q:number): void { this.currentCart.update(c=> c.map(x=>x.recipeId===recipeId?{...x,quantity:q}:x).filter(x=>x.quantity>0)); }
  removeFromCart(recipeId:string): void { this.currentCart.update(c=>c.filter(x=>x.recipeId!==recipeId)); }
  updateComment(recipeId:string,v:string):void{ this.currentCart.update(c=>c.map(x=>x.recipeId===recipeId?{...x,recipeLineComment:v || 'Sin observaciones'}:x)); }
  clearCart(): void { this.currentCart.set([]); }

  completeSale(): void {
    const payload = this.buildPayload();
    if (!payload) return;
    this.submitting.set(true);
    this.salesService.createSale(payload).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.pushToast('warning', 'Venta recibida. Se está procesando con inventario.');
        this.clearCart();
        this.trackProcessing(response.saleId, 'create');
        this.refreshSales();
      },
      error: (error) => { this.submitting.set(false); this.pushToast('error', this.readError(error)); }
    });
  }

  patchStatus(id:string,status:SaleStatus):void{ if(!this.canPatchTo(this.sales().find(s=>s.id===id)?.status,status)) return; this.salesService.patchSaleStatus(id,status).subscribe({next:()=>{this.pushToast('warning','Cambio de estado enviado a procesamiento.');this.trackProcessing(id,'patch');},error:e=>this.pushToast('error',this.readError(e))}); }
  deleteSale(sale:SaleResponse):void{ if(sale.status==='COMPLETED'){this.pushToast('warning','No se puede eliminar una venta completada.');return;} if(!confirm('¿Eliminar esta venta?')) return; this.salesService.deleteSale(sale.id).subscribe({next:()=>{this.pushToast('warning','Eliminación solicitada. Se está procesando con inventario.');this.trackProcessing(sale.id,'delete');},error:e=>this.pushToast('error',this.readError(e))}); }
  refreshPreparations(saleId:string):void{ this.salesService.getSalePreparations(saleId).subscribe({next:t=>{this.preparationTracesBySaleId.update(s=>({...s,[saleId]:t})); if(t.some(x=>x.status==='REJECTED')) this.pushToast('warning','Una o más recetas fueron rechazadas por inventario.');},error:()=>{}}); }

  private refreshSales(): void { this.loading.set(true); this.salesService.getSales().subscribe({next:(sales)=>{this.sales.set(sales ?? []); this.loading.set(false);},error:(error)=>{this.loading.set(false); this.pushToast('error', this.readLoadSalesError(error));}}); }
  private loadSaleableItems(): void { this.saleableItems.set([{id:'dddddddd-dddd-dddd-dddd-dddddddddddd',name:'Receta Inactiva Prueba',price:6500,active:true,visibleInMenu:true,stock:99}]); }

  private buildPayload(): SaleRequest | null {
    if (!this.selectedSellerId() || !this.selectedLocationId() || !this.selectedTableId()) return this.pushToast('error','Seller, location y mesa son obligatorios.'), null;
    if (this.currentCart().length === 0) return this.pushToast('error','Agrega productos a la venta.'), null;
    if (this.currentCart().some(l => !l.recipeId || l.quantity <= 0 || l.unitPrice <= 0 || !l.recipeLineComment.trim())) return this.pushToast('error','Valida cantidades, precios y observaciones.'), null;
    return { sellerId:this.selectedSellerId(), locationId:this.selectedLocationId(), tableId:this.selectedTableId(), details:this.currentCart().map(l=>({recipeId:l.recipeId,quantity:l.quantity,unitPrice:l.unitPrice,recipeLineComment:l.recipeLineComment,lineDisplayName:l.name})) };
  }

  private trackProcessing(saleId:string, mode:'create'|'patch'|'delete'): void {
    this.processingSaleIds.update(ids => ids.includes(saleId) ? ids : [...ids, saleId]);
    const startedAt = Date.now();
    interval(3000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.salesService.getSaleById(saleId).pipe(catchError((e: HttpErrorResponse) => of(e)))),
      tap((result) => {
        const timeout = Date.now() - startedAt > 60000;
        if (result instanceof HttpErrorResponse && result.status === 404 && !timeout) { return; }
        if (timeout) { this.pushToast('warning', `La ${mode === 'delete' ? 'eliminación' : 'venta'} sigue en procesamiento.`); this.stopTracking(saleId); return; }
        if (result instanceof HttpErrorResponse) { this.pushToast('error', this.readError(result)); this.stopTracking(saleId); return; }
        if (mode === 'delete') {
          this.pushToast('warning', 'La eliminación aún no se refleja, sigue en procesamiento.');
        } else {
          this.refreshSales();
          this.refreshPreparations(saleId);
          if (result.status === 'CANCELLED') this.pushToast('warning', 'Venta cancelada durante validación de inventario.');
          else this.pushToast('success', 'Venta actualizada en historial.');
        }
        this.stopTracking(saleId);
      })
    ).subscribe();
  }

  canPatchTo(current: SaleStatus | undefined, target: SaleStatus): boolean {
    if (!current) return false;
    if (current === 'CREATED') return target === 'IN_PROGRESS' || target === 'CANCELLED';
    if (current === 'IN_PROGRESS') return target === 'COMPLETED' || target === 'CANCELLED';
    return false;
  }

  isProcessing(saleId:string): boolean { return this.processingSaleIds().includes(saleId); }
  tracesBySaleId(saleId:string): RecipePreparationTrace[] { return this.preparationTracesBySaleId()[saleId] ?? []; }
  private stopTracking(saleId:string):void{ this.processingSaleIds.update(ids=>ids.filter(id=>id!==saleId)); }
  private pushToast(type:'success'|'error'|'warning',message:string):void{ this.toastType.set(type); this.toastMessage.set(message); setTimeout(()=>this.toastMessage.set(''), 4500); }

  private readLoadSalesError(error: unknown): string {
    const err = error as HttpErrorResponse;
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    if (err.status === 401) return 'Sesión expirada. Inicia sesión nuevamente.';
    return 'No se pudieron cargar las ventas.';
  }

  private readError(error: unknown): string { const err=error as HttpErrorResponse; if(err.status===401) return 'Sesión expirada. Inicia sesión nuevamente.'; if(err.status===403) return 'No tienes permisos para realizar esta acción.'; if(err.status===404) return 'Venta no encontrada.'; if(err.status===0) return 'No se pudo conectar con el servidor.'; return err.error?.message ?? 'Ocurrió un error inesperado.'; }
}
