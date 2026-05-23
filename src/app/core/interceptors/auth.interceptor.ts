import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TOKEN_STORAGE_KEY } from '@features/user/services/auth.service';
import { catchError, throwError } from 'rxjs';

const LOGIN_ENDPOINT = '/userapi/v1/users/login';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isLoginRequest = req.url.includes(LOGIN_ENDPOINT);

  if (isLoginRequest) {
    return next(req);
  }

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const requestWithAuth = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(requestWithAuth).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
