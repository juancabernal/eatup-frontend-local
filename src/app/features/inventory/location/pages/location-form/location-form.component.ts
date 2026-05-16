import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { extractHttpErrorMessage } from '@core/utils/http-error-message.util';
import { LocationRequest, LocationResponse } from '../../models/location.model';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="form-card">
      <header class="form-header">
        <div>
          <h2>{{ location ? 'Editar sede' : 'Nueva sede' }}</h2>
          <p>Completa los datos operativos y de contacto de la sede.</p>
        </div>
      </header>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="location-form">
        <div class="form-grid">
          <label>
            Nombre
            <input class="input" type="text" formControlName="name" placeholder="Sede principal" />
            <span class="field-error" *ngIf="isInvalid('name')">El nombre es requerido.</span>
          </label>

          <label>
            Ciudad
            <input class="input" type="text" formControlName="city" placeholder="Bogotá" />
            <span class="field-error" *ngIf="isInvalid('city')">La ciudad es requerida.</span>
          </label>

          <label class="full-row">
            Dirección
            <input
              class="input"
              type="text"
              formControlName="address"
              placeholder="Calle 123 #45-67"
            />
            <span class="field-error" *ngIf="isInvalid('address')">La dirección es requerida.</span>
          </label>

          <label>
            Email
            <input
              class="input"
              type="email"
              formControlName="email"
              placeholder="sede@eatup.com"
            />
            <span class="field-error" *ngIf="isInvalid('email')">Ingresa un email válido.</span>
          </label>

          <label>
            Teléfono
            <input
              class="input"
              type="tel"
              formControlName="phoneNumber"
              placeholder="+573001234567"
            />
            <span class="field-error" *ngIf="isInvalid('phoneNumber')"
              >Usa entre 7 y 15 dígitos, con + opcional.</span
            >
          </label>

          <label>
            Hora de apertura
            <input class="input" type="time" formControlName="startTime" step="60" />
            <span class="field-error" *ngIf="isInvalid('startTime')"
              >La hora de apertura es requerida.</span
            >
          </label>

          <label>
            Hora de cierre
            <input class="input" type="time" formControlName="endTime" step="60" />
            <span class="field-error" *ngIf="isInvalid('endTime')"
              >La hora de cierre es requerida.</span
            >
          </label>

          <label class="check-row">
            <input type="checkbox" formControlName="active" />
            Sede activa
          </label>
        </div>

        <p class="submit-error" *ngIf="errorMessage()">{{ errorMessage() }}</p>

        <footer class="form-actions">
          <button
            class="btn btn-secondary"
            type="button"
            (click)="onCancel()"
            [disabled]="isSaving()"
          >
            Cancelar
          </button>
          <button class="btn btn-primary" type="submit" [disabled]="isSaving()">
            {{ isSaving() ? 'Guardando...' : 'Guardar' }}
          </button>
        </footer>
      </form>
    </section>
  `,
  styles: [
    `
      .form-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 1.25rem;
        box-shadow: 0 14px 35px rgba(15, 23, 42, 0.08);
        margin-bottom: 1.25rem;
      }
      .form-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-header h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
      }
      .form-header p {
        margin: 0.25rem 0 0;
        color: #64748b;
      }
      .location-form {
        display: grid;
        gap: 1rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        color: #334155;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .full-row,
      .check-row {
        grid-column: 1 / -1;
      }
      .check-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .check-row input {
        width: 18px;
        height: 18px;
        accent-color: var(--color-primary);
      }
      .input {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 0.7rem 0.85rem;
        color: #0f172a;
        outline: none;
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease;
      }
      .input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.14);
      }
      .field-error,
      .submit-error {
        color: #dc2626;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .submit-error {
        margin: 0;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.65rem;
      }
      .btn {
        border: none;
        border-radius: 12px;
        padding: 0.68rem 1rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          transform 0.18s ease,
          opacity 0.18s ease;
      }
      .btn:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background: var(--color-primary);
        color: #fff;
      }
      .btn-secondary {
        background: #e5e7eb;
        color: #334155;
      }
      @media (max-width: 720px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LocationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly locationService = inject(LocationService);
  private currentLocation?: LocationResponse;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    city: ['', Validators.required],
    address: ['', Validators.required],
    active: [true, Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
  });

  @Input() set location(value: LocationResponse | undefined) {
    this.currentLocation = value;
    if (value) {
      this.form.reset({
        name: value.name,
        city: value.city,
        address: value.address,
        active: value.active,
        email: value.email,
        phoneNumber: value.phoneNumber,
        startTime: this.formatTo24h(value.startTime),
        endTime: this.formatTo24h(value.endTime),
      });
    } else {
      this.form.reset({
        name: '',
        city: '',
        address: '',
        active: true,
        email: '',
        phoneNumber: '',
        startTime: '',
        endTime: '',
      });
    }
    this.errorMessage.set('');
  }

  get location(): LocationResponse | undefined {
    return this.currentLocation;
  }

  isInvalid(controlName: keyof LocationRequest): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    const rawValue = this.form.getRawValue();
    const payload: LocationRequest = {
      ...rawValue,
      startTime: this.formatTo24h(rawValue.startTime),
      endTime: this.formatTo24h(rawValue.endTime),
    };
    const request$ = this.currentLocation
      ? this.locationService.updateLocation(this.currentLocation.id, payload)
      : this.locationService.createLocation(payload);

    request$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        this.saved.emit();
        this.close.emit();
      },
      error: (error) =>
        this.errorMessage.set(
          extractHttpErrorMessage(error, 'No se pudo guardar la sede. Intenta nuevamente.'),
        ),
    });
  }

  onCancel(): void {
    this.close.emit();
  }

  private formatTo24h(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/a\.\s*m\./g, 'am')
      .replace(/p\.\s*m\./g, 'pm')
      .replace(/a\s*m/g, 'am')
      .replace(/p\s*m/g, 'pm');

    const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/);
    if (!timeMatch) {
      return value;
    }

    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const meridiem = timeMatch[3];

    if (meridiem === 'am') {
      hours = hours === 12 ? 0 : hours;
    } else if (meridiem === 'pm') {
      hours = hours === 12 ? 12 : hours + 12;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
}
