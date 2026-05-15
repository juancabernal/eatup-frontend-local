import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENV } from '@config/env.config';
import { RecipeResponse } from '@commercial/sales/models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${ENV.apiUrl}/recipes`;

  getRecipes(): Observable<RecipeResponse[]> {
    return this.http.get<RecipeResponse[]>(this.baseUrl);
  }
}
