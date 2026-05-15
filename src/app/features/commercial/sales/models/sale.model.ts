export type SaleStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type RecipePreparationTraceStatus = 'ACCEPTED' | 'REJECTED';

export interface SaleDetailRequest {
  recipeId: string;
  quantity: number;
  unitPrice: number;
  recipeLineComment: string;
  lineDisplayName?: string | null;
}

export interface SaleRequest {
  sellerId: string;
  locationId: string;
  tableId: string;
  details: SaleDetailRequest[];
}

export interface SaleAsyncResponse {
  saleId: string;
  message: string;
  requestedAt: string;
}

export interface SaleDetailResponse {
  id?: string;
  recipeId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  recipeLineComment: string;
  lineDisplayName?: string | null;
}

export interface SaleResponse {
  id: string;
  sellerId: string;
  locationId: string;
  tableId: string;
  status: SaleStatus;
  totalAmount: number;
  details: SaleDetailResponse[];
  createdDate?: string;
  modifiedDate?: string;
}

export interface RecipePreparationTrace {
  id: string;
  saleId: string;
  saleDetailId: string;
  recipeId: string;
  status: RecipePreparationTraceStatus;
  observation?: string | null;
  createdDate?: string;
  modifiedDate?: string;
}

export interface SaleableItem {
  id: string;
  name: string;
  price: number;
  stock?: number;
  active?: boolean;
  visibleInMenu?: boolean;
}
