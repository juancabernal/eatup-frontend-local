export interface RecipeResponse {
  id: string;
  name: string;
  categoryId: string;
  locationId: string;
  productIds: string[];
  subRecipeIds: string[];
  baseCost: number;
  profitMargin: number;
  sellingPrice: number;
  visibleInMenu: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleableRecipe {
  id: string;
  name: string;
  price: number;
  active: boolean;
  visibleInMenu: boolean;
  description?: string;
}
