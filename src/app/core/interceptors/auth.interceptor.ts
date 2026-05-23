import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@features/user/services/auth.service';
import { catchError, throwError } from 'rxjs';

const LOGIN_ENDPOINT = '/userapi/v1/users/login';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const isLoginRequest = req.url.includes(LOGIN_ENDPOINT);

  if (isLoginRequest) {
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
      if (error.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
