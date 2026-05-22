import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ENV } from '@config/env.config';
import {
  CityOption,
  DepartmentOption,
  DocumentTypeOption,
  LocationOption,
  RegisterUserPayload
} from '@features/user/models/user-profile.model';

interface RegisterCatalogs {
  documentTypes: DocumentTypeOption[];
  departments: DepartmentOption[];
  locations: LocationOption[];
}

@Injectable({ providedIn: 'root' })
export class UserRegisterService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = ENV.apiUrl.replace('/api/v1', '');

  async loadCatalogs(): Promise<RegisterCatalogs> {
    const [docTypesResult, depsResult, locationsResult] = await Promise.allSettled([
      firstValueFrom(this.http.get<DocumentTypeOption[]>(`${this.apiRoot}/userapi/v1/document-types`)),
      firstValueFrom(this.http.get<DepartmentOption[]>(`${this.apiRoot}/userapi/v1/departments`)),
      firstValueFrom(this.http.get<LocationOption[]>(`${this.apiRoot}/inventory/api/v1/location/active`))
    ]);

    return {
      documentTypes: docTypesResult.status === 'fulfilled' ? docTypesResult.value : [],
      departments: depsResult.status === 'fulfilled' ? depsResult.value : [],
      locations: locationsResult.status === 'fulfilled' ? locationsResult.value : []
    };
  }

  async loadCities(departmentId: string): Promise<CityOption[]> {
    if (!departmentId) return [];

    try {
      return await firstValueFrom(this.http.get<CityOption[]>(
        `${this.apiRoot}/userapi/v1/cities`,
        { params: { departmentId } }
      ));
    } catch {
      return [];
    }
  }

  async registerUser(payload: RegisterUserPayload): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiRoot}/userapi/v1/users`, payload));
  }

  getBackendErrorMessage(error: unknown): string {
    const asAny = error as {
      error?: { message?: string };
      message?: string;
    };

    if (asAny?.error?.message?.trim()) {
      return asAny.error.message;
    }

    if (asAny?.message?.trim()) {
      return asAny.message;
    }

    return '';
  }
}
