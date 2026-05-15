import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, of, Subject, switchMap, takeUntil, catchError, tap } from 'rxjs';
import { SalesService } from '@commercial/sales/services/sales.service';
import { RecipeService } from '@commercial/sales/services/recipe.service';
import { RestaurantTable, RestaurantTableService } from '@commercial/sales/services/restaurant-table.service';
import { Seller, SellerService } from '@commercial/sales/services/seller.service';
import { ENV } from '@config/env.config';
import { RecipePreparationTrace, SaleRequest, SaleResponse, SaleStatus } from '@commercial/sales/models/sale.model';
import { RecipeResponse, SaleableRecipe } from '@commercial/sales/models/recipe.model';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type VisibilityFilter = 'ALL' | 'VISIBLE' | 'HIDDEN';
type SortMode = 'NAME_ASC' | 'PRICE_ASC' | 'PRICE_DESC';
interface CartLine { recipeId: string; recipeName: string; lineDisplayName: string; quantity: number; unitPrice: number; recipeLineComment: string; }
@Component({ selector: 'app-sales-pos-page', standalone: true, imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe], templateUrl: './sales-pos-page.html', styleUrl: './sales-pos-page.css' })
export class SalesPosPage implements OnInit, OnDestroy {
private readonly salesService = inject(SalesService); private readonly recipeService = inject(RecipeService); private readonly tableService = inject(RestaurantTableService); private readonly sellerService = inject(SellerService); private readonly destroy$ = new Subject<void>();
private readonly cdr = inject(ChangeDetectorRef);
private readonly ngZone = inject(NgZone);
readonly recipes = signal<SaleableRecipe[]>([]); readonly recipeNameById = signal<Record<string, string>>({}); readonly sales = signal<SaleResponse[]>([]); readonly currentCart = signal<CartLine[]>([]);
readonly searchQuery = signal(''); readonly statusFilter = signal<StatusFilter>('ALL'); readonly visibilityFilter = signal<VisibilityFilter>('ALL'); readonly minPrice = signal<number | null>(null); readonly maxPrice = signal<number | null>(null); readonly sortMode = signal<SortMode>('NAME_ASC');
readonly selectedSellerName = signal('Selecciona un vendedor'); readonly selectedSellerId = signal(''); readonly availableSellers = signal<Seller[]>([]); readonly sellerSelectorOpen = signal(false); readonly loadingSellers = signal(false); readonly sellerQuery = signal('');
readonly selectedLocationId = signal(ENV.locationId); readonly selectedLocationLabel = signal('Sede configurada'); readonly selectedTableId = signal<string | null>(null); readonly selectedTableLabel = signal('Selecciona una mesa'); readonly availableTables = signal<RestaurantTable[]>([]); readonly tableSelectorOpen = signal(false); readonly loadingTables = signal(false); readonly tableQuery = signal('');
readonly loadingRecipes = signal(false); readonly loadingSales = signal(false); readonly submitting = signal(false); readonly recipeError = signal(false); readonly processingSaleIds = signal<string[]>([]); readonly loadingTraceSaleId = signal(''); readonly preparationTracesBySaleId = signal<Record<string, RecipePreparationTrace[]>>({});
readonly commentEditorOpen = signal(false); readonly commentTargetRecipeId = signal(''); readonly commentTargetRecipeName = signal(''); readonly commentDraft = signal('');
readonly toastMessage = signal(''); readonly toastType = signal<'success'|'error'|'warning'|'info'>('success'); readonly toastProgress = signal(100); private toastTimer?: ReturnType<typeof setTimeout>;
readonly filteredRecipes = computed(() => this.recipes().filter(i => (!this.searchQuery() || i.name.toLowerCase().includes(this.searchQuery().toLowerCase().trim())) && (this.statusFilter()==='ALL' || (this.statusFilter()==='ACTIVE'?i.active:!i.active)) && (this.visibilityFilter()==='ALL' || (this.visibilityFilter()==='VISIBLE'?i.visibleInMenu:!i.visibleInMenu)) && (this.minPrice()===null || i.price>=this.minPrice()!) && (this.maxPrice()===null || i.price<=this.maxPrice()!)).sort((a,b)=>this.sortMode()==='PRICE_ASC'?a.price-b.price:this.sortMode()==='PRICE_DESC'?b.price-a.price:a.name.localeCompare(b.name,'es')));
readonly validCartItems = computed(() => this.currentCart().filter(l => !!l.recipeId && !!(l.recipeName || l.lineDisplayName)));
ngOnInit(){this.loadRecipes();this.refreshSales();this.loadSellers();} ngOnDestroy(){this.destroy$.next();this.destroy$.complete();}
computeSubtotal(){return this.validCartItems().reduce((a,l)=>a+l.quantity*l.unitPrice,0)} computeTotal(){return this.computeSubtotal()} cartItemsCount(){return this.validCartItems().reduce((a,l)=>a+l.quantity,0)}
addToCart(item: SaleableRecipe){ if(!item.id||!item.name)return; if(!item.active)return this.pushToast('warning','No puedes vender una receta inactiva.'); if(!item.price||item.price<=0)return this.pushToast('warning','Precio no disponible para esta receta.'); this.currentCart.update(c=>{const idx=c.findIndex(x=>x.recipeId===item.id); if(idx===-1)return [...c,{recipeId:item.id,recipeName:item.name,lineDisplayName:item.name,quantity:1,unitPrice:item.price,recipeLineComment:'Sin observaciones'}]; const n=[...c]; n[idx]={...n[idx],quantity:n[idx].quantity+1}; return n;}); }
updateQuantity(id:string,q:number){this.currentCart.update(c=>c.map(x=>x.recipeId===id?{...x,quantity:Math.max(1,q||1)}:x));} removeFromCart(id:string){this.currentCart.update(c=>c.filter(x=>x.recipeId!==id));} updateComment(id:string,v:string){this.currentCart.update(c=>c.map(x=>x.recipeId===id?{...x,recipeLineComment:(v||'Sin observaciones').trim()||'Sin observaciones'}:x));}
	openCommentEditor(line:CartLine){
		const recipeId = line.recipeId;
		const recipeName = line.recipeName||line.lineDisplayName||'Receta';
		const initial = (line.recipeLineComment||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
		const popup = window.open('', '_blank', 'width=640,height=480');
		if(!popup){ this.pushToast('error','No se pudo abrir la pestaña para el comentario. Revisa el bloqueador de ventanas.'); return; }
		// small editor page that posts the comment back to opener
		const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comentario - ${recipeName}</title></head><body style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:12px;"><h3>Comentario para ${recipeName}</h3><textarea id="comment" rows="10" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px">${initial}</textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="cancel">Cancelar</button><button id="save" style="background:#22c55e;color:#fff;border:none;padding:8px 12px;border-radius:8px">Guardar</button></div><script>const save=document.getElementById('save');const cancel=document.getElementById('cancel');save.addEventListener('click',()=>{const comment=document.getElementById('comment').value;window.opener.postMessage({type:'sale-comment',recipeId:'${recipeId}',comment},'*');});cancel.addEventListener('click',()=>{window.close();});</script></body></html>`;
		popup.document.open(); popup.document.write(html); popup.document.close();
		const listener = (e: MessageEvent) => {
			if(e.source !== popup) return; const data = e.data as any; if(data?.type==='sale-comment' && data?.recipeId===recipeId){ this.updateComment(recipeId, (data.comment||'').trim() || 'Sin observaciones'); try{ popup.close(); }catch{} window.removeEventListener('message', listener); }};
		window.addEventListener('message', listener);
	}
	closeCommentEditor(){ this.commentEditorOpen.set(false); }
	saveComment(){ this.updateComment(this.commentTargetRecipeId(), this.commentDraft()); this.closeCommentEditor(); }
openTableSelector(){this.tableSelectorOpen.set(true); if(this.availableTables().length>0)return; this.loadingTables.set(true); this.tableService.getTables().subscribe({next:t=>{this.ngZone.run(()=>{this.availableTables.set([...(t??[])]);this.loadingTables.set(false);this.cdr.markForCheck();});},error:()=>{this.ngZone.run(()=>{this.loadingTables.set(false);this.pushToast('error','No se pudieron cargar las mesas.');this.cdr.markForCheck();});}})}
closeTableSelector(){this.tableSelectorOpen.set(false);} selectTable(t:RestaurantTable){if(!this.isTableAvailable(t))return this.pushToast('warning','Debes seleccionar una mesa disponible.'); this.selectedTableId.set(t.id); this.selectedTableLabel.set(this.tableLabel({ ...t })); this.pushToast('success','Mesa seleccionada correctamente.'); this.closeTableSelector(); this.cdr.markForCheck();}
openSellerSelector(){this.sellerSelectorOpen.set(true); if(this.availableSellers().length===0 && !this.loadingSellers()) this.loadSellers();} closeSellerSelector(){this.sellerSelectorOpen.set(false);} filteredSellers(){const q=this.sellerQuery().toLowerCase().trim(); return this.availableSellers().filter(s=>!q||this.sellerDisplayName(s).toLowerCase().includes(q)||(s.document??'').toLowerCase().includes(q));}
filteredTables(){const q=this.tableQuery().toLowerCase().trim(); return this.availableTables().filter(t=>!q||this.tableLabel(t).toLowerCase().includes(q)||String(t.number??'').toLowerCase().includes(q));}
selectSeller(s:Seller){if(!this.isSellerActive(s))return; const selected={ ...s }; this.selectedSellerId.set(selected.id); this.selectedSellerName.set(this.sellerDisplayName(selected)); this.pushToast('success','Vendedor seleccionado correctamente.'); this.closeSellerSelector(); this.cdr.markForCheck();}
completeSale(){const payload=this.buildPayload(); if(!payload)return; this.submitting.set(true); this.salesService.createSale(payload).subscribe({next:r=>{this.submitting.set(false);this.pushToast('success','Venta creada correctamente.');this.currentCart.set([]);this.trackProcessing(r.saleId,'create');this.refreshSales();},error:e=>{this.submitting.set(false);this.pushToast('error',this.readError(e));}})}
refreshPreparations(saleId:string){this.loadingTraceSaleId.set(saleId); this.salesService.getSalePreparations(saleId).subscribe({next:t=>{this.ngZone.run(()=>{this.loadingTraceSaleId.set(''); this.preparationTracesBySaleId.update(s=>({...s,[saleId]:[...(t??[])]})); if((t??[]).some(x=>x.status==='REJECTED'))this.pushToast('warning','Una o más recetas fueron rechazadas por inventario.'); this.cdr.markForCheck();});},error:()=>{this.ngZone.run(()=>{this.loadingTraceSaleId.set(''); this.pushToast('error','No se pudo cargar la trazabilidad.'); this.cdr.markForCheck();});}});}
buildPayload(){ if(!this.selectedSellerId()) return this.pushToast('warning','Debes seleccionar un vendedor.'),null; if(!this.selectedTableId()) return this.pushToast('warning','Debes seleccionar una mesa disponible.'),null; if(!this.selectedLocationId()) return this.pushToast('error','Sede obligatoria.'),null; const validLines=this.validCartItems(); if(validLines.length===0) return this.pushToast('warning','Agrega al menos una receta a la venta.'),null; if(validLines.some(l=>l.quantity<=0)) return this.pushToast('warning','Todas las cantidades deben ser mayores a cero.'),null; if(validLines.some(l=>l.unitPrice<=0)) return this.pushToast('warning','Todas las recetas deben tener precio válido.'),null; return {sellerId:this.selectedSellerId(),locationId:this.selectedLocationId(),tableId:this.selectedTableId()!,details:validLines.map(l=>({recipeId:l.recipeId,quantity:l.quantity,unitPrice:l.unitPrice,recipeLineComment:l.recipeLineComment?.trim()||'Sin observaciones',lineDisplayName:l.lineDisplayName||l.recipeName}))} as SaleRequest; }
shortSaleCode(id:string){return `Venta #${id.slice(-6).toUpperCase()}`;} saleStatusLabel(s:SaleStatus){return({CREATED:'Creada',IN_PROGRESS:'En proceso',COMPLETED:'Completada',CANCELLED:'Cancelada'})[s];} traceStatusLabel(s:'ACCEPTED'|'REJECTED'){return s==='ACCEPTED'?'Aceptada':'Rechazada';} traceRecipeName(id:string){return this.recipeNameById()[id]??'Receta no encontrada';}
canPatchTo(c:SaleStatus|undefined,t:SaleStatus){if(!c)return false; if(c==='CREATED')return t==='IN_PROGRESS'||t==='CANCELLED'; if(c==='IN_PROGRESS')return t==='COMPLETED'||t==='CANCELLED'; return false;} isProcessing(id:string){return this.processingSaleIds().includes(id);} tracesBySaleId(id:string){return this.preparationTracesBySaleId()[id]??[];} isTraceLoading(id:string){return this.loadingTraceSaleId()===id;}
isTableAvailable(t:RestaurantTable){if(t.available===false)return false; if(t.occupied===true)return false; const status=(t.status??'').toUpperCase(); if(['OCCUPIED','OCUPADA','BUSY','IN_USE'].includes(status))return false; if(t.available===true)return true; if(t.occupied===false)return true; if(['AVAILABLE','DISPONIBLE','FREE','LIBRE'].includes(status))return true; return false;} tableLabel(t:RestaurantTable){return t.displayName||t.name||(t.number?`Mesa ${t.number}`:t.code||'Mesa sin nombre');} tableStateLabel(t:RestaurantTable){if(this.isTableAvailable(t))return 'Disponible'; const status=(t.status??'').toUpperCase(); if(t.available===false||t.occupied===true||['OCCUPIED','OCUPADA','BUSY','IN_USE'].includes(status))return 'Ocupada'; return 'Estado desconocido';}
isSellerActive(s:Seller){if(s.active!==undefined)return s.active; if(s.status)return !['INACTIVE','DISABLED'].includes(s.status.toUpperCase()); return true;} sellerDisplayName(s:Seller){return s.fullName||s.name||`${s.firstName??''} ${s.lastName??''}`.trim()||(s.document?`Vendedor ${s.document}`:'Vendedor sin nombre');}
patchStatus(id:string,status:SaleStatus){if(!this.canPatchTo(this.sales().find(s=>s.id===id)?.status,status))return; this.salesService.patchSaleStatus(id,status).subscribe({next:()=>{this.pushToast('info','Cambio de estado enviado a procesamiento.');this.trackProcessing(id,'patch');},error:e=>this.pushToast('error',this.readError(e))});}
deleteSale(s:SaleResponse){if(s.status==='COMPLETED')return this.pushToast('warning','No se puede eliminar una venta completada.'); this.salesService.deleteSale(s.id).subscribe({next:()=>{this.pushToast('info','Eliminación solicitada. Se está procesando con inventario.');this.trackProcessing(s.id,'delete');},error:e=>this.pushToast('error',this.readError(e))});}
private refreshSales(){this.loadingSales.set(true);this.salesService.getSales().subscribe({next:s=>{this.ngZone.run(()=>{const normalized=(s??[]).map(sale=>({ ...sale, details:[...(sale.details??[])] })); this.sales.set(normalized);this.loadingSales.set(false);this.cdr.markForCheck();});},error:e=>{this.ngZone.run(()=>{this.loadingSales.set(false);this.pushToast('error',this.readLoadSalesError(e));this.cdr.markForCheck();});}})}
private loadRecipes(){
	this.loadingRecipes.set(true);
	this.recipeError.set(false);
	this.recipeService.getRecipes().subscribe({
		next:(r:RecipeResponse[])=>{
			this.ngZone.run(()=>{
				const normalized=(r??[]).map(x=>({id:x.id,name:x.name,price:x.sellingPrice,active:x.active,visibleInMenu:x.visibleInMenu}));
				this.recipes.set([...normalized]);
				this.recipeNameById.set(normalized.reduce((a,c)=>({...a,[c.id]:c.name}),{}));
				this.loadingRecipes.set(false);
				this.cdr.markForCheck();
			});
		},
		error:()=>{
			this.ngZone.run(()=>{
				this.loadingRecipes.set(false);
				this.recipeError.set(true);
				this.pushToast('error','No se pudieron cargar las recetas.');
				this.cdr.markForCheck();
			});
		}
	})
}
private loadSellers(){
	this.loadingSellers.set(true);
	this.sellerService.getSellers().subscribe({
		next:s=>{
			this.ngZone.run(()=>{
				this.availableSellers.set([...(s??[]).filter(v=>!!v.id)]);
				this.loadingSellers.set(false);
				this.cdr.markForCheck();
			});
		},
		error:(error)=>{console.error('Error cargando vendedores', error);this.ngZone.run(()=>{this.loadingSellers.set(false);this.pushToast('error','No se pudieron cargar los vendedores.');this.cdr.markForCheck();});}
	})
}
private trackProcessing(saleId:string,mode:'create'|'patch'|'delete'){this.processingSaleIds.update(ids=>ids.includes(saleId)?ids:[...ids,saleId]);const startedAt=Date.now();interval(3000).pipe(takeUntil(this.destroy$),switchMap(()=>this.salesService.getSaleById(saleId).pipe(catchError((e:HttpErrorResponse)=>of(e)))),tap((result)=>{const timeout=Date.now()-startedAt>60000;if(result instanceof HttpErrorResponse&&result.status===404&&!timeout)return;if(timeout){this.pushToast('warning',`La ${mode==='delete'?'eliminación':'venta'} sigue en procesamiento.`);return this.stopTracking(saleId);}if(result instanceof HttpErrorResponse){this.pushToast('error',this.readError(result));return this.stopTracking(saleId);}if(mode!=='delete'){this.refreshSales();this.refreshPreparations(saleId);}this.stopTracking(saleId);})).subscribe();}
private stopTracking(saleId:string){this.processingSaleIds.update(ids=>ids.filter(id=>id!==saleId));}
private pushToast(type:'success'|'error'|'warning'|'info',message:string){this.toastType.set(type);this.toastMessage.set(message);this.toastProgress.set(100);if(this.toastTimer)clearTimeout(this.toastTimer);const started=Date.now();const total=4500;const progressInterval=setInterval(()=>{const elapsed=Date.now()-started;this.toastProgress.set(Math.max(0,100-(elapsed/total)*100));if(elapsed>=total)clearInterval(progressInterval);},100);this.toastTimer=setTimeout(()=>{this.toastMessage.set('');this.toastProgress.set(0);clearInterval(progressInterval);},total);}
closeToast(){if(this.toastTimer)clearTimeout(this.toastTimer);this.toastMessage.set('');this.toastProgress.set(0);} private readLoadSalesError(error:unknown){const err=error as HttpErrorResponse; if(err.status===0)return'No se pudo conectar con el servidor.';if(err.status===401)return'Sesión expirada. Inicia sesión nuevamente.';return'No se pudieron cargar las ventas.';} private readError(error:unknown){const err=error as HttpErrorResponse; return err.error?.message??'No se pudo crear la venta.';}
}
