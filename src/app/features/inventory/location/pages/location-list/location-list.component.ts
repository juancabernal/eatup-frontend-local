import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LocationResponse } from '../../models/location.model';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-location-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
})
export class LocationListComponent implements OnInit {
  locations = signal<LocationResponse[]>([]);
  loading = signal(false);
  filtering = signal(false);
  errorMessage = signal('');
  infoMessage = signal('');
  successMessage = signal('');
  togglingById = signal<Record<string, boolean>>({});

  searchTerm = signal('');
  statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  filteredLocations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    let list = this.locations();

    if (term) {
      list = list.filter((location) =>
        [location.name, location.city, location.address, location.email, location.phoneNumber]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }

    if (this.statusFilter() === 'ACTIVE') {
      list = list.filter((location) => location.active);
    } else if (this.statusFilter() === 'INACTIVE') {
      list = list.filter((location) => !location.active);
    }

    return list;
  });

  constructor(
    private readonly locationService: LocationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const navState = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    if (navState?.successMessage) {
      this.successMessage.set(navState.successMessage);
    }
    this.loadLocations();
  }

  loadLocations(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.locationService.list().subscribe({
      next: (data) => {
        this.locations.set(data ?? []);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          this.extractBackendMessage(error, 'No se pudieron cargar las sedes.'),
        );
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.triggerFiltering();
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as 'ALL' | 'ACTIVE' | 'INACTIVE');
    this.triggerFiltering();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
  }

  goToCreate(): void {
    this.router.navigate(['/inv/locations/create']);
  }

  goToEdit(location: LocationResponse): void {
    this.router.navigate(['/inv/locations', location.id, 'edit']);
  }

  toggleStatus(location: LocationResponse): void {
    if (this.togglingById()[location.id]) return;

    this.infoMessage.set('');
    this.successMessage.set('');
    this.errorMessage.set('');
    this.markToggling(location.id, true);
    const nextStatus = !location.active;

    this.locationService.updateStatus(location.id, { active: !location.active }).subscribe({
      next: () => {
        this.locations.update((list) =>
          list.map((item) => (item.id === location.id ? { ...item, active: nextStatus } : item)),
        );
        this.successMessage.set(`La sede se ${nextStatus ? 'activó' : 'inactivó'} correctamente.`);
        this.markToggling(location.id, false);
      },
      error: (error) => {
        this.errorMessage.set(
          this.extractBackendMessage(
            error,
            `No se pudo ${location.active ? 'inactivar' : 'activar'} la sede.`,
          ),
        );
        this.markToggling(location.id, false);
      },
    });
  }

  isToggling(id: string): boolean {
    return !!this.togglingById()[id];
  }

  private triggerFiltering(): void {
    this.filtering.set(true);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.filtering.set(false), 300);
  }

  private extractBackendMessage(error: any, fallback: string): string {
    if (typeof error?.error === 'string' && error.error.trim()) return error.error;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    if (typeof error?.error?.message === 'string' && error.error.message.trim())
      return error.error.message;
    if (typeof error?.error?.detail === 'string' && error.error.detail.trim())
      return error.error.detail;

    const validationErrors = error?.error?.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      return validationErrors.join(' · ');
    }

    if (validationErrors && typeof validationErrors === 'object') {
      return Object.values(validationErrors).flat().join(' · ');
    }

    return fallback;
  }

  private markToggling(id: string, value: boolean): void {
    this.togglingById.update((state) => ({ ...state, [id]: value }));
  }
}
