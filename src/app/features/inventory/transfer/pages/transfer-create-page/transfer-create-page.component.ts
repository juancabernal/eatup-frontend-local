import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ENV } from '@config/env.config';
import { CreateTransferRequest } from '../../models/transfer.model';
import { TransferService } from '../../services/transfer.service';

@Component({
  selector: 'app-transfer-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <div class="page-header">
        <div>
          <a class="back-link" routerLink="..">Volver a traslados</a>
          <p class="eyebrow">Inventory / Transfer</p>
          <h1>Crear traslado</h1>
          <p>
            Programa una salida entre sedes y deja listo el flujo para que origen gestione
            transito o cancelacion desde el tablero.
          </p>
        </div>
      </div>

      <div class="form-layout">
        <form class="form-card" (ngSubmit)="submit()">
          <div class="section-grid">
            <div class="field">
              <label for="sedeOrigen">Sede origen</label>
              <input
                id="sedeOrigen"
                type="text"
                class="input"
                [(ngModel)]="form.sedeOrigen"
                name="sedeOrigen"
                placeholder="UUID de sede origen"
                required>
              <small>Se precarga con la sede del entorno local.</small>
            </div>

            <div class="field">
              <label for="sedeDestino">Sede destino</label>
              <input
                id="sedeDestino"
                type="text"
                class="input"
                [(ngModel)]="form.sedeDestino"
                name="sedeDestino"
                placeholder="UUID de sede destino"
                required>
            </div>

            <div class="field">
              <label for="fechaEnvio">Fecha de envio</label>
              <input
                id="fechaEnvio"
                type="datetime-local"
                class="input"
                [(ngModel)]="form.fechaEnvio"
                name="fechaEnvio"
                required>
            </div>

            <div class="field">
              <label for="fechaLlegada">Fecha de llegada</label>
              <input
                id="fechaLlegada"
                type="datetime-local"
                class="input"
                [(ngModel)]="form.fechaLlegada"
                name="fechaLlegada"
                required>
            </div>

            <div class="field">
              <label for="responsable">Responsable</label>
              <input
                id="responsable"
                type="text"
                class="input"
                [(ngModel)]="form.responsable"
                name="responsable"
                placeholder="Nombre de quien despacha"
                required>
            </div>

            <div class="field">
              <label for="producto">Producto</label>
              <input
                id="producto"
                type="text"
                class="input"
                [(ngModel)]="form.producto"
                name="producto"
                placeholder="Nombre del producto"
                required>
            </div>

            <div class="field">
              <label for="cantidad">Cantidad</label>
              <input
                id="cantidad"
                type="number"
                class="input"
                [(ngModel)]="form.cantidad"
                name="cantidad"
                min="1"
                required>
            </div>
          </div>

          <div class="field field-full">
            <label for="observaciones">Observaciones</label>
            <textarea
              id="observaciones"
              class="input textarea"
              [(ngModel)]="form.observaciones"
              name="observaciones"
              rows="4"
              placeholder="Notas opcionales del traslado"></textarea>
          </div>

          @if (error()) {
            <div class="alert-error">{{ error() }}</div>
          }

          @if (successMessage()) {
            <div class="alert-success">{{ successMessage() }}</div>
          }

          <div class="action-row">
            <button class="btn-primary" type="submit" [disabled]="submitting() || !isFormValid()">
              {{ submitting() ? 'Creando...' : 'Crear traslado' }}
            </button>
            <a class="btn-ghost" routerLink="..">Cancelar</a>
          </div>
        </form>

        <aside class="guide-card">
          <h2>Reglas del flujo</h2>
          <ul>
            <li>Origen puede pasar a <strong>EN_TRANSITO</strong> o <strong>CANCELADO</strong>.</li>
            <li>Destino puede <strong>COMPLETAR</strong> o <strong>RECLAMAR</strong>.</li>
            <li>El backend valida sede y estado con el flujo real que ya probaste.</li>
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header {
      background: linear-gradient(135deg, var(--color-background) 0%, #fff 100%);
      border: 1px solid #f1e3d7;
      border-radius: 1rem;
      padding: 1.5rem;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 0.75rem;
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
    }
    .eyebrow {
      margin: 0 0 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
      color: #94a3b8;
    }
    h1 { margin: 0; color: var(--color-secondary); font-size: 2rem; }
    .page-header p:last-child { margin: 0.75rem 0 0; color: #64748b; max-width: 720px; }
    .form-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
      gap: 1.5rem;
      align-items: start;
    }
    .form-card, .guide-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 1px 6px rgba(0,0,0,0.04);
    }
    .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1rem; }
    .field-full { margin-bottom: 1rem; }
    label { font-size: 0.875rem; font-weight: 700; color: #334155; }
    small { color: #64748b; }
    .input {
      border: 1px solid #cbd5e1;
      border-radius: 0.75rem;
      padding: 0.8rem 0.9rem;
      font: inherit;
      color: #0f172a;
      background: #fff;
    }
    .input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(255,107,53,0.2);
    }
    .textarea { resize: vertical; min-height: 120px; }
    .action-row { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; }
    .btn-primary, .btn-ghost {
      border-radius: 0.75rem;
      padding: 0.75rem 1.2rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: var(--color-primary); color: white; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.25); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost { background: transparent; color: var(--color-primary); }
    .alert-error, .alert-success {
      border-radius: 0.8rem;
      padding: 0.9rem 1rem;
      margin-top: 0.75rem;
    }
    .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .guide-card h2 { margin-top: 0; color: var(--color-secondary); }
    .guide-card ul { margin: 1rem 0 0; padding-left: 1.2rem; color: #475569; display: grid; gap: 0.9rem; }
    @media (max-width: 960px) {
      .form-layout { grid-template-columns: 1fr; }
      .section-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class TransferCreatePageComponent {
  private readonly transferService = inject(TransferService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = {
    sedeOrigen: ENV.locationId,
    sedeDestino: '',
    fechaEnvio: '',
    fechaLlegada: '',
    responsable: '',
    producto: '',
    cantidad: 1,
    observaciones: ''
  };

  protected isFormValid(): boolean {
    return Boolean(
      this.form.sedeOrigen.trim() &&
      this.form.sedeDestino.trim() &&
      this.form.fechaEnvio &&
      this.form.fechaLlegada &&
      this.form.responsable.trim() &&
      this.form.producto.trim() &&
      this.form.cantidad > 0
    );
  }

  protected submit(): void {
    if (!this.isFormValid()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    const payload: CreateTransferRequest = {
      sedeOrigen: this.form.sedeOrigen.trim(),
      sedeDestino: this.form.sedeDestino.trim(),
      fechaEnvio: this.toIsoLocal(this.form.fechaEnvio),
      fechaLlegada: this.toIsoLocal(this.form.fechaLlegada),
      responsable: this.form.responsable.trim(),
      producto: this.form.producto.trim(),
      cantidad: this.form.cantidad,
      observaciones: this.form.observaciones.trim() || undefined
    };

    this.transferService.create(payload).subscribe({
      next: transfer => {
        this.submitting.set(false);
        this.successMessage.set(`Traslado #${transfer.idTraslado} creado correctamente.`);
        setTimeout(() => this.router.navigate(['/inventory/transfer']), 1200);
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'No fue posible crear el traslado.');
      }
    });
  }

  private toIsoLocal(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
  }
}
