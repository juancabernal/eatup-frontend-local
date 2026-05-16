import { Injectable } from '@angular/core';
import { ENV } from '@config/env.config';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  readonly apiUrl = ENV.apiUrl;
  readonly userToken = ENV.userToken;
}
