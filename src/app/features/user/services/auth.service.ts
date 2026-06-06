import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ENV } from '@config/env.config';
import { LoginRequest, LoginResponse } from '../models/login.model';

export const TOKEN_STORAGE_KEY = 'eatup_auth_token';
export const LOCATION_STORAGE_KEY = 'eatup_location_id';

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

interface UserSummaryResponse {
  id: string;
  email: string;
  location?: string;
  locationId?: string;
}

interface LocationOption {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = ENV.apiUrl.replace('/api/v1', '');

  private readonly _token = signal<string | null>(
    this.readToken()
  );

  private readonly _locationId = signal<string>(
    localStorage.getItem(LOCATION_STORAGE_KEY) ?? ''
  );

  readonly token = this._token.asReadonly();
  readonly locationId = this._locationId.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  getToken(): string | null {
    const storedToken = this.readToken();

    if (storedToken !== this._token()) {
      this._token.set(storedToken);
    }

    return storedToken;
  }

    setLocationId(locationId: string): void {
    if (locationId) {
      this.persistLocationId(locationId);
    }
  }

  getLocationId(): string {
    const storedLocationId = localStorage.getItem(LOCATION_STORAGE_KEY) ?? '';

    if (storedLocationId !== this._locationId()) {
      this._locationId.set(storedLocationId);
    }

    return storedLocationId;
  }


  hasValidSession(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  syncTokenFromStorage(): void {
    const storedToken = this.readToken();

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

        this.persistToken(token);
      }),
      switchMap(response => {
        const responseLocationId = this.extractLocationId(response);
        if (responseLocationId) {
          this.persistLocationId(responseLocationId);
          return of(response);
        }

        return this.synchronizeUserLocation().pipe(
          map(() => response),
          catchError(() => of(response))
        );
      })
    );
  }

  synchronizeUserLocation(): Observable<string> {
    const tokenEmail = this.extractEmailFromToken();
    if (!tokenEmail) {
      return of(this.getLocationId());
    }

    return forkJoin({
      users: this.http.get<UserSummaryResponse[]>(`${this.baseUrl}/userapi/v1/users`, {
        params: { page: '0', size: '100' }
      }),
      locations: this.http.get<LocationOption[]>(`${this.baseUrl}/inventory/api/v1/location`)
    }).pipe(
      map(({ users, locations }) => {
        const currentUser = users.find(user => this.matchesUserEmail(user.email, tokenEmail));
        const locationId = this.resolveLocationId(currentUser, locations);

        if (locationId) {
          this.persistLocationId(locationId);
        }

        return locationId;
      })
    );
  }

  logout(): void {
    this.clearCookie(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LOCATION_STORAGE_KEY);
    this._token.set(null);
    this._locationId.set('');
  }

  private persistToken(token: string): void {
    this.setCookie(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this._token.set(token);
  }

  private persistLocationId(locationId: string): void {
    localStorage.setItem(LOCATION_STORAGE_KEY, locationId);
    this._locationId.set(locationId);
  }

  private readToken(): string | null {
    return this.getCookie(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private extractLocationId(response: LoginResponse): string {
    const source = response as LoginResponse & { locationId?: string; user?: { locationId?: string } };
    return (source.locationId || source.user?.locationId || '').trim();
  }

  private extractEmailFromToken(): string {
    const token = this.getToken();
    if (!token) return '';

    const parts = token.split('.');
    if (parts.length < 2) return '';

    try {
      const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as JwtPayload;
      return this.normalize(payload.sub || payload.email || '');
    } catch {
      return '';
    }
  }

  private isTokenExpired(token: string): boolean {
    const parts = token.split('.');
    if (parts.length < 2) return false;

    try {
      const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as JwtPayload;

      if (!payload.exp) {
        return false;
      }

      return payload.exp * 1000 <= Date.now();
    } catch {
      return false;
    }
  }


  private resolveLocationId(user: UserSummaryResponse | undefined, locations: LocationOption[]): string {
    const raw = (user?.locationId || user?.location || '').trim();
    if (!raw) return '';

    const byId = locations.find(location => location.id === raw);
    if (byId) return byId.id;

    const byName = locations.find(location => this.normalize(location.name) === this.normalize(raw));
    return byName?.id ?? raw;
  }

  private matchesUserEmail(listEmail: string, tokenEmail: string): boolean {
    const a = this.normalize(listEmail);
    const b = this.normalize(tokenEmail);

    if (!a || !b) return false;
    if (a.includes('*') || b.includes('*')) return false;

    return a === b;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private setCookie(name: string, value: string): void {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  }

  private getCookie(name: string): string | null {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null;
  }

  private clearCookie(name: string): void {
    const encodedName = encodeURIComponent(name);
    const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const maxAge = 'Max-Age=0';
    const sameSite = 'SameSite=Lax';
    const hostname = window.location.hostname;
    const domains = hostname ? [hostname, `.${hostname}`] : [];

    document.cookie = `${encodedName}=; path=/; ${expires}; ${maxAge}; ${sameSite}`;

    for (const domain of domains) {
      document.cookie = `${encodedName}=; path=/; domain=${domain}; ${expires}; ${maxAge}; ${sameSite}`;
    }
  }
}
