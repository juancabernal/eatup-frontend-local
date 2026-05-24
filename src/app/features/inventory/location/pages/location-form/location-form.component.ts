import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LocationRequest } from '../../models/location.model';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.css'
})
export class LocationFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locationService = inject(LocationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly isEditMode = signal(false);
  readonly successMessage = signal('');

  private locationId = '';

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    city: ['', [Validators.required]],
    address: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    startTime: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)]],
    endTime: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)]],
    active: [true, [Validators.required]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.locationId = id;
    this.isEditMode.set(true);
    this.loading.set(true);

    this.locationService.getById(id).subscribe({
      next: location => {
        this.form.patchValue(location);
        this.loading.set(false);
      },
      error: error => {
        this.errorMessage.set(this.extractBackendMessage(error, 'No se pudo cargar la sede.'));
        this.loading.set(false);
      }
    });
  }

  submit(): void {
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.infoMessage.set(
      this.isEditMode()
        ? 'Espere un momento, su sede se está actualizando.'
        : 'Espere un momento, su sede se está creando.',
    );
    const payload = this.normalizePayload();

    const request$ = this.isEditMode()
      ? this.locationService.update(this.locationId, payload)
      : this.locationService.create(payload);

    request$.subscribe({
      next: () => {
        this.infoMessage.set('');
        this.successMessage.set(
          this.isEditMode()
            ? 'Su sede se actualizó de manera correcta.'
            : 'Su sede se creó de manera correcta.',
        );
        this.saving.set(false);
      },
      error: error => {
        this.errorMessage.set(this.extractBackendMessage(error, 'No se pudo guardar la sede.'));
        this.saving.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/inv/locations']);
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.touched || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (field === 'email' && control.errors['email']) return 'El correo debe incluir @ y un dominio válido.';
    if (field === 'phoneNumber' && control.errors['pattern']) {
      return 'El teléfono debe tener entre 7 y 15 números.';
    }
    if ((field === 'startTime' || field === 'endTime') && control.errors['pattern']) {
      return 'La hora debe tener formato HH:mm.';
    }

    return 'El valor ingresado no es válido.';
  }

  private normalizePayload(): LocationRequest {
    const raw = this.form.getRawValue();

    return {
      name: (raw.name ?? '').trim(),
      city: (raw.city ?? '').trim(),
      address: (raw.address ?? '').trim(),
      active: !!raw.active,
      email: (raw.email ?? '').trim(),
      phoneNumber: (raw.phoneNumber ?? '').trim(),
      startTime: this.normalizeTime(raw.startTime ?? ''),
      endTime: this.normalizeTime(raw.endTime ?? '')
    };
  }

  private normalizeTime(value: string): string {
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (!match) return value;

    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private extractBackendMessage(error: any, fallback: string): string {
    if (typeof error?.error === 'string' && error.error.trim()) return error.error;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    if (typeof error?.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }
    if (typeof error?.error?.detail === 'string' && error.error.detail.trim()) {
      return error.error.detail;
    }

    const validationErrors = error?.error?.errors;

    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      return validationErrors.join(' · ');
    }

    if (validationErrors && typeof validationErrors === 'object') {
      return Object.values(validationErrors).flat().join(' · ');
    }

    return fallback;
  }
}
