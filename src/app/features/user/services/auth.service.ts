import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ENV } from '@config/env.config';
import { LoginRequest, LoginResponse } from '../models/login.model';

export const TOKEN_STORAGE_KEY = 'eatup_auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = ENV.apiUrl.replace('/api/v1', '');

  private readonly _token = signal<string | null>(this.resolveInitialToken());

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  private resolveInitialToken(): string | null {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) return stored;

    // Si hay un token en el env (dev), lo sincronizamos a localStorage
    const envToken = ENV.userToken || null;
    if (envToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, envToken);
    }
    return envToken;
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.baseUrl}/userapi/v1/users/login`,
      request
    ).pipe(
      tap(response => {
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        this._token.set(response.token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this._token.set(null);
  }
}
