import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <div class="brand-logo">
            <span class="brand-icon">🍽</span>
            <h1 class="brand-name">EatUp</h1>
          </div>
          <p class="subtitle">Ingresa a tu cuenta para continuar</p>
        </div>

        @if (errorMsg()) {
          <div class="alert-error">
            <span class="alert-icon">⚠</span>
            {{ errorMsg() }}
          </div>
        }

        <form class="login-form" (ngSubmit)="submit()" #loginForm="ngForm">
          <div class="field">
            <label for="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              placeholder="tucorreo@ejemplo.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <div class="password-wrapper">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                placeholder="••••••••"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="toggle-password"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                {{ showPassword() ? '🙈' : '👁' }}
              </button>
            </div>
          </div>

          <button type="submit" class="btn-login" [disabled]="isLoading() || !email() || !password()">
            @if (isLoading()) {
              <span class="spinner-sm"></span>
              Iniciando sesión...
            } @else {
              Iniciar sesión
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--color-background);
      padding: 1rem;
    }

    .login-card {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 420px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .brand-icon {
      font-size: 2rem;
    }

    .brand-name {
      margin: 0;
      font-size: 2rem;
      font-weight: 800;
      color: var(--color-secondary);
      letter-spacing: -0.5px;
    }

    .subtitle {
      margin: 0;
      color: #64748b;
      font-size: 0.9375rem;
    }

    .alert-error {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .field input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      color: var(--color-text);
      background: #f8fafc;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
      box-sizing: border-box;
    }

    .field input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12);
      background: white;
    }

    .password-wrapper {
      position: relative;
    }

    .password-wrapper input {
      padding-right: 3rem;
    }

    .toggle-password {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 0.25rem;
      line-height: 1;
      color: #94a3b8;
    }

    .btn-login {
      margin-top: 0.5rem;
      padding: 0.875rem 1.5rem;
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-login:hover:not(:disabled) {
      background-color: #e85a24;
    }

    .btn-login:active:not(:disabled) {
      transform: scale(0.98);
    }

    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner-sm {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly errorMsg = signal('');

  protected submit(): void {
    if (!this.email() || !this.password()) return;

    this.isLoading.set(true);
    this.errorMsg.set('');

    this.authService.login({ email: this.email(), password: this.password() }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401 || err.status === 403) {
          this.errorMsg.set('Correo o contraseña incorrectos.');
        } else if (err.status === 0) {
          this.errorMsg.set('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
        } else {
          this.errorMsg.set('Ocurrió un error al iniciar sesión. Intenta de nuevo.');
        }
      }
    });
  }
}
