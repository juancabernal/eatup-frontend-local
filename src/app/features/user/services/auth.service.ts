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

  private readonly _token = signal<string | null>(
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());


  getToken(): string | null {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (storedToken !== this._token()) {
      this._token.set(storedToken);
    }

    return storedToken;
  }

  hasValidSession(): boolean {
    return !!this.getToken();
  }

  syncTokenFromStorage(): void {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (storedToken !== this._token()) {
      this._token.set(storedToken);
    }
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.baseUrl}/userapi/v1/users/login`,
      request
    ).pipe(
      tap(response => {
        const token = response.token || response.accessToken || response.jwt;

        if (!token) {
          throw new Error('La respuesta de autenticación no contiene token.');
        }

        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        this._token.set(token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this._token.set(null);
  }
}
