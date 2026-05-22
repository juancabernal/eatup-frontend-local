import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected isLoading = false;
  protected errorMsg = '';

  protected submit(): void {
    if (!this.email || !this.password) return;

    this.isLoading = true;
    this.errorMsg = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401 || err.status === 403) {
          this.errorMsg = 'Correo o contrasena incorrectos.';
        } else if (err.status === 0) {
          this.errorMsg = 'No se pudo conectar con el servidor. Verifica que el backend este corriendo.';
        } else {
          this.errorMsg = 'Ocurrio un error al iniciar sesion. Intenta de nuevo.';
        }
      }
    });
  }
}
