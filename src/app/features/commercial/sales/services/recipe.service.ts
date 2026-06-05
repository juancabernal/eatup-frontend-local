import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { EnvironmentService } from '../../../../core/services/environment.service';
import { RecipeResponse } from '../models/sales.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  constructor(private readonly http: HttpClient, private readonly env: EnvironmentService) {}

  getRecipes(): Observable<RecipeResponse[]> {
    return this.http.get<unknown>(`${this.env.apiUrl}/recipes`).pipe(
      map(value => this.normalizeRecipes(value))
    );
  }

  private normalizeRecipes(value: unknown): RecipeResponse[] {
    if (Array.isArray(value)) {
      return value as RecipeResponse[];
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const response = value as Record<string, unknown>;
    const candidates = [
      response['content'],
      response['data'],
      response['items'],
      response['recipes']
    ];

    return (candidates.find(Array.isArray) ?? []) as RecipeResponse[];
  }
}
