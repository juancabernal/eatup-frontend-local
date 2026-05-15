import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ENV } from '@config/env.config';

/**
 * Interceptor temporal que agrega el token del usuario desde el environment.
 * Una vez implementada la autenticación real, reemplazar `ENV.userToken`
 * por el token obtenido del servicio de autenticación.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = ENV.userToken;

  if (!token || token === 'your_jwt_token_here' || token === 'your_production_jwt_token_here') {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};
