import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, interval, of, switchMap, take } from 'rxjs';
import { CartItem, RecipePreparationTrace, RecipeResponse, RestaurantTable, SaleResponse, SaleStatus, Seller } from '../../models/sales.model';
import { RecipeService } from '../../services/recipe.service';
import { SalesService } from '../../services/sales.service';
import { SellerTableService } from '../../services/seller-table.service';
import { EnvironmentService } from '../../../../../core/services/environment.service';

@Component({
  selector: 'app-sales-page', standalone: true, imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './sales-page.component.html', styleUrl: './sales-page.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesPageComponent implements OnInit {
  recipes: RecipeResponse[] = []; sales: SaleResponse[] = []; cartItems: CartItem[] = []; tracesBySaleId: Record<string, RecipePreparationTrace[]> = {};
  sellers: Seller[] = []; tables: RestaurantTable[] = []; recipeQuery = ''; selectedSellerId = ''; selectedSellerName = ''; selectedTableId = ''; selectedTableName = '';
  showCommentModal = false; showSellerModal = false; showTableModal = false; showDeleteModal = false; selectedCartRecipeId = ''; modalComment = 'Sin observaciones'; deletingSaleId = '';
  loading = false;
  constructor(private salesService: SalesService, private recipeService: RecipeService, private sellerTableService: SellerTableService, private cdr: ChangeDetectorRef, public env: EnvironmentService) {}
  ngOnInit(): void { this.loadAll(); }
  loadAll() { this.loading = true; forkJoin([this.recipeService.getRecipes(), this.salesService.getSales(), this.sellerTableService.getSellers(), this.sellerTableService.getTables()]).pipe(finalize(()=>{this.loading=false; this.cdr.markForCheck();})).subscribe({next:([r,s,se,t])=>{this.recipes=[...r];this.sales=[...s];this.sellers=[...se];this.tables=[...t];},error:()=>{}}); }
  get filteredRecipes(){ return this.recipes.filter(r=>r.name?.toLowerCase().includes(this.recipeQuery.toLowerCase())); }
  addToCart(recipe: RecipeResponse){ if(!recipe.active||recipe.sellingPrice<=0)return; const i=this.cartItems.find(x=>x.recipeId===recipe.id); this.cartItems=i?this.cartItems.map(x=>x.recipeId===recipe.id?{...x,quantity:x.quantity+1}:x):[...this.cartItems,{recipeId:recipe.id,recipeName:recipe.name,lineDisplayName:recipe.name,quantity:1,unitPrice:recipe.sellingPrice,recipeLineComment:'Sin observaciones'}]; this.cdr.markForCheck(); }
  updateQty(id:string,qty:number){ const q=Math.max(1,qty||1); this.cartItems=this.cartItems.map(x=>x.recipeId===id?{...x,quantity:q}:x); }
  removeItem(id:string){ this.cartItems=this.cartItems.filter(x=>x.recipeId!==id); }
  openComment(item:CartItem){ this.selectedCartRecipeId=item.recipeId; this.modalComment=item.recipeLineComment||'Sin observaciones'; this.showCommentModal=true; }
  saveComment(){ const c=this.modalComment.trim()||'Sin observaciones'; this.cartItems=this.cartItems.map(x=>x.recipeId===this.selectedCartRecipeId?{...x,recipeLineComment:c}:x); this.showCommentModal=false; }
  get total(){ return this.cartItems.reduce((a,b)=>a+b.quantity*b.unitPrice,0); }
  completeSale(){ if(!this.selectedSellerId||!this.selectedTableId||!this.cartItems.length) return; const payload={sellerId:this.selectedSellerId,locationId:(window as any).ENV?.LOCATION_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',tableId:this.selectedTableId,details:this.cartItems.map(i=>({recipeId:i.recipeId,quantity:i.quantity,unitPrice:i.unitPrice,recipeLineComment:i.recipeLineComment||'Sin observaciones',lineDisplayName:i.lineDisplayName}))}; this.salesService.createSale(payload).subscribe({next:(res)=>{this.cartItems=[]; this.refreshSales(); if(res.saleId){ interval(2500).pipe(take(4), switchMap(()=>this.salesService.getSaleById(res.saleId))).subscribe({next:()=>this.refreshSales(),error:()=>{}}); }}}); }
  refreshSales(){ this.salesService.getSales().subscribe(s=>{this.sales=[...s]; this.cdr.markForCheck();}); }
  changeStatus(id:string,status:SaleStatus){ this.salesService.patchSaleStatus(id,status).subscribe(()=>this.refreshSales()); }
  askDelete(id:string){ this.deletingSaleId=id; this.showDeleteModal=true; }
  deleteSale(){ this.salesService.deleteSale(this.deletingSaleId).subscribe(()=>{this.showDeleteModal=false; this.refreshSales();}); }
  loadTrace(id:string){ this.salesService.getSalePreparations(id).subscribe(t=>{this.tracesBySaleId={...this.tracesBySaleId,[id]:[...t]}; this.cdr.markForCheck();}); }
  pickSeller(s:Seller){ this.selectedSellerId=s.id; this.selectedSellerName=s.fullName||s.name||`${s.firstName??''} ${s.lastName??''}`.trim(); this.showSellerModal=false; }
  tableAvailable(t:RestaurantTable){ const s=(t.status||'').toUpperCase(); if(t.available===true||t.occupied===false||['AVAILABLE','DISPONIBLE','FREE','LIBRE'].includes(s)) return true; if(t.available===false||t.occupied===true||['OCCUPIED','OCUPADA','BUSY','IN_USE'].includes(s)) return false; return false; }
  pickTable(t:RestaurantTable){ if(!this.tableAvailable(t)) return; this.selectedTableId=t.id; this.selectedTableName=t.displayName||t.name|| (t.number ? `Mesa ${t.number}` : t.code) || 'Mesa sin nombre'; this.showTableModal=false; }
  saleLabel(id:string){ return `#${id.slice(-6).toUpperCase()}`; }
  recipeNameById(id:string){ return this.recipes.find(r=>r.id===id)?.name ?? 'Receta no encontrada'; }
}
