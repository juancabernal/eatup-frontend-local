import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@features/user/services/auth.service';
import { catchError, throwError } from 'rxjs';

const LOGIN_ENDPOINT = '/userapi/v1/users/login';
const REGISTER_USER_ENDPOINT = '/userapi/v1/users';

const PUBLIC_CATALOG_ENDPOINTS = [
  '/userapi/v1/document-types',
  '/userapi/v1/departments',
  '/userapi/v1/cities',
  '/inventory/api/v1/location/active'
];

function isPublicRequest(url: string, method: string): boolean {
  if (url.includes(LOGIN_ENDPOINT)) {
    return true;
  }

  // Registration is public only for user creation requests.
  if (method === 'POST' && url.includes(REGISTER_USER_ENDPOINT)) {
    return true;
  }

  return PUBLIC_CATALOG_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const publicRequest = isPublicRequest(req.url, req.method);

  if (publicRequest) {
    return next(req);
  }

  const token = authService.getToken();

  if (!token) {
    void router.navigate(['/login']);
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'No authentication token',
      url: req.url
    }));
  }

  const requestWithAuth = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(requestWithAuth).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !authService.hasValidSession()) {
        authService.logout();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
