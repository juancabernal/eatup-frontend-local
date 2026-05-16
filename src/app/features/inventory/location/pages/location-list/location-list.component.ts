import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LocationResponse } from '../../models/location.model';
import { LocationService } from '../../services/location.service';
import { LocationFormComponent } from '../location-form/location-form.component';

@Component({
  selector: 'app-location-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule, LocationFormComponent],
  template: `
    <div class="locations-page">
      <header class="page-header">
        <div>
          <h1>Sedes</h1>
          <p>Gestiona las sedes disponibles para la operación de inventario.</p>
        </div>
        <button class="btn btn-primary" type="button" (click)="openCreateForm()">Nueva sede</button>
      </header>

      <app-location-form
        *ngIf="showForm()"
        [location]="selectedLocation()"
        (close)="closeForm()"
        (saved)="onSaved()">
      </app-location-form>

      <section class="surface">
        <div class="table-header">
          <h2>Listado de sedes</h2>
          <span class="muted">{{ locations().length }} registros</span>
        </div>

        <div class="loading-state" *ngIf="isLoading()">Cargando sedes...</div>
        <div class="error-state" *ngIf="errorMessage() && !isLoading()">{{ errorMessage() }}</div>

        <div class="table-wrap" *ngIf="!isLoading() && !errorMessage()">
          <table class="locations-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Dirección</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let location of locations(); trackBy: trackByLocationId">
                <td>{{ location.name }}</td>
                <td>{{ location.city }}</td>
                <td>{{ location.address }}</td>
                <td>{{ location.email }}</td>
                <td>{{ location.phoneNumber }}</td>
                <td>{{ location.startTime }} – {{ location.endTime }}</td>
                <td>
                  <span class="badge" [class.badge-active]="location.active" [class.badge-inactive]="!location.active">
                    {{ location.active ? 'Activa' : 'Inactiva' }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button class="btn btn-soft" type="button" (click)="editLocation(location)">Editar</button>
                    <button class="btn btn-ghost" type="button" (click)="toggleActive(location)">
                      {{ location.active ? 'Desactivar' : 'Activar' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="locations().length === 0">
                <td colspan="8" class="empty-state">No hay sedes registradas.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .locations-page { display: grid; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: linear-gradient(135deg, var(--color-secondary), #0f172a); color: #fff; border-radius: 20px; padding: 1.5rem; box-shadow: 0 18px 45px rgba(15, 23, 42, .18); }
    .page-header h1 { margin: 0; font-size: 1.9rem; }
    .page-header p { margin: .35rem 0 0; color: #cbd5e1; }
    .surface { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.15rem; box-shadow: 0 12px 30px rgba(15, 23, 42, .07); }
    .table-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .table-header h2 { margin: 0; color: #0f172a; font-size: 1.25rem; }
    .muted { color: #64748b; font-size: .9rem; }
    .table-wrap { overflow-x: auto; }
    .locations-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 980px; }
    .locations-table th, .locations-table td { padding: .8rem .7rem; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: middle; }
    .locations-table th { background: #f8fafc; color: #64748b; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
    .locations-table tbody tr:hover { background: #fff7ed; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: .28rem .65rem; font-size: .78rem; font-weight: 700; border: 1px solid transparent; }
    .badge-active { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .badge-inactive { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .actions { display: flex; flex-wrap: wrap; gap: .45rem; }
    .btn { border: none; border-radius: 12px; padding: .62rem .9rem; font-weight: 700; cursor: pointer; transition: transform .18s ease, background-color .18s ease, opacity .18s ease; }
    .btn:hover:not(:disabled) { transform: translateY(-1px); }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn-primary { background: var(--color-primary); color: #fff; }
    .btn-soft { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }
    .btn-ghost { background: #fff; border: 1px solid #cbd5e1; color: #0f172a; }
    .loading-state, .empty-state { color: #64748b; text-align: center; padding: 1.5rem; }
    .error-state { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: .9rem; }
    @media (max-width: 720px) { .page-header { align-items: stretch; flex-direction: column; } .page-header .btn { width: 100%; } }
  `]
})
export class LocationListComponent implements OnInit {
  readonly locations = signal<LocationResponse[]>([]);
  readonly isLoading = signal(false);
  readonly showForm = signal(false);
  readonly selectedLocation = signal<LocationResponse | undefined>(undefined);
  readonly errorMessage = signal('');

  constructor(private readonly locationService: LocationService) {}

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.locationService.getLocations()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: locations => this.locations.set(locations),
        error: () => this.errorMessage.set('No se pudieron cargar las sedes.')
      });
  }

  openCreateForm(): void {
    this.selectedLocation.set(undefined);
    this.showForm.set(true);
  }

  editLocation(location: LocationResponse): void {
    this.selectedLocation.set(location);
    this.showForm.set(true);
  }

  toggleActive(location: LocationResponse): void {
    this.locationService.patchLocation(location.id, { active: !location.active }).subscribe({
      next: () => this.loadLocations(),
      error: () => this.errorMessage.set('No se pudo actualizar el estado de la sede.')
    });
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedLocation.set(undefined);
  }

  onSaved(): void {
    this.closeForm();
    this.loadLocations();
  }

  trackByLocationId(_index: number, location: LocationResponse): string {
    return location.id;
  }
}
