import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CustomerDiscountService } from '@commercial/customer-discount/services/customer-discount';
import { CustomerDiscount } from '@commercial/customer-discount/models/customer-discount.model';
import { DiscountService } from '@commercial/discount/services/discount';
import { ClientService } from '@commercial/customer-discount/services/client';
import { LocationService } from '@commercial/customer-discount/services/location';
import { ENV } from '@config/env.config';
import { FormsModule } from '@angular/forms';
import { CustomerDiscountFilterPipe } from '@commercial/customer-discount/pipes/customer-discount-filter.pipe';
import { CustomerDiscountExpiryBadgeComponent } from '@commercial/customer-discount/components/customer-discount-expiry-badge/customer-discount-expiry-badge';
import { DiscountStatusBadgeComponent } from '@commercial/discount/components/discount-status-badge/discount-status-badge';
import { CustomerDiscountRefreshService } from '@commercial/customer-discount/services/customer-discount-refresh.service';

@Component({
  selector: 'app-customer-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, CustomerDiscountExpiryBadgeComponent, DiscountStatusBadgeComponent],
  templateUrl: './customer-discount-list-page.html',
  styleUrl: './customer-discount-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class CustomerDiscountListPage implements OnInit, OnDestroy {
  private readonly service         = inject(CustomerDiscountService);
  private readonly discountService = inject(DiscountService);
  private readonly clientService   = inject(ClientService);
  private readonly locationService = inject(LocationService);
  private readonly refreshService = inject(CustomerDiscountRefreshService);
  private excludeId = '';


  protected readonly items        = signal<CustomerDiscount[]>([]);
  protected readonly discountMap  = signal<Map<string, string>>(new Map());
  protected readonly discountActiveMap = signal<Map<string, boolean>>(new Map());
  protected readonly clientMap    = signal<Map<string, string>>(new Map());
  protected readonly locationName = signal('Cargando...');
  protected readonly loading      = signal(false);
  protected readonly error        = signal('');
  protected readonly currentPage  = signal(1);
  protected readonly pageSize     = 5;
  protected readonly search       = signal('');
  protected readonly sortBy       = signal<'assignedAt' | 'startDate' | 'endDate' | ''>('');

  private readonly filterPipe = new CustomerDiscountFilterPipe();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.excludeId = history.state?.deletedId ?? '';

    this.discountService.getAll().subscribe({
      next: (data) => {
        this.discountMap.set(
          new Map(data.map(d => [d.id, `${d.description} (${d.percentage}%)`]))
        );
        this.discountActiveMap.set(
          new Map(data.map(d => [d.id, d.status]))
        );
      }
    });

    this.clientService.getAll().subscribe({
      next: (data) => this.clientMap.set(new Map(data.map(c => [c.id, `${c.firstName} ${c.firstLastName} — ${c.documentNumber}`])))
    });

    const locId = ENV.locationId;
    if (locId) {
      this.locationService.getById(locId).subscribe({
        next:  (loc) => this.locationName.set(loc.name),
        error: ()    => this.locationName.set('Sede no encontrada')
      });
    }

    this.load();

    this.refreshService.onRefresh$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.load());
  }

  protected discountName(id: string): string  { return this.discountMap().get(id) ?? '—'; }
  protected clientName(id: string): string    { return this.clientMap().get(id)   ?? '—'; }
  protected discountActive(id: string): boolean { return this.discountActiveMap().get(id) ?? true; }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.getAll().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (data) => {
        const list = this.excludeId ? data.filter(i => i.id !== this.excludeId) : data;
        this.items.set(list);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Error al cargar.')
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar esta asignación?')) return;
    this.items.update(list => list.filter(i => i.id !== id));
    this.service.delete(id).subscribe({
      error: () => { this.error.set('Error al eliminar.'); this.load(); }
    });
  }

  protected readonly filteredItems = computed(() => {
    let list = this.filterPipe.transform(this.items(), this.search(), this.discountMap(), this.clientMap());
    switch (this.sortBy()) {
      case 'assignedAt':
        list = [...list].sort((a, b) => new Date(b.assignedAt ?? 0).getTime() - new Date(a.assignedAt ?? 0).getTime());
        break;
      case 'startDate':
        list = [...list].sort((a, b) => new Date(a.startDate ?? '9999').getTime() - new Date(b.startDate ?? '9999').getTime());
        break;
      case 'endDate':
        list = [...list].sort((a, b) => new Date(a.endDate ?? '9999').getTime() - new Date(b.endDate ?? '9999').getTime());
        break;
    }
    return list;
  });

  protected readonly totalPages = computed(() =>
    Math.ceil(this.filteredItems().length / this.pageSize)
  );

  protected readonly paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredItems().slice(start, start + this.pageSize);
  });
  
  goToPage(page: number): void {
  if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }
  
  onSearch(value: string): void { this.search.set(value); this.currentPage.set(1); }

  onSort(value: string): void  { this.sortBy.set(value as any); this.currentPage.set(1); }

  protected truncate(text: string, max = 50): string {
    return text && text.length > max ? text.slice(0, max) + '...' : (text ?? '');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}