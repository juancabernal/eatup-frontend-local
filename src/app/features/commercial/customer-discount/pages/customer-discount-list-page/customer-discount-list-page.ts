import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, EMPTY } from 'rxjs';
import { finalize, takeUntil, switchMap, catchError } from 'rxjs/operators';
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
  protected readonly locationName = signal('—');
  protected readonly loading      = signal(false);
  protected readonly error        = signal('');
  protected readonly currentPage  = signal(1);
  protected readonly pageSize     = 5;
  protected readonly search       = signal('');
  protected readonly sortBy       = signal<'assignedAt' | 'startDate' | 'endDate' | ''>('');
  protected readonly expiryFilter = signal<'all' | 'vigente' | 'por_vencer' | 'vencido'>('all');
  protected readonly confirmDeleteId = signal<string | null>(null);

  private readonly filterPipe = new CustomerDiscountFilterPipe();
  private readonly destroy$ = new Subject<void>();
  private readonly loadTrigger$ = new Subject<void>();

  ngOnInit(): void {
    this.excludeId = history.state?.deletedId ?? '';

  this.discountService.getAll().subscribe({
    next: (data) => {
      this.discountMap.set(new Map(data.map(d => [d.id, `${d.description} (${d.percentage}%)`])));
      this.discountActiveMap.set(new Map(data.map(d => [d.id, d.status])));
    },
    error: () => this.error.set('Error al cargar los descuentos disponibles.')
  });

  this.clientService.getAll().subscribe({
    next: (data) => this.clientMap.set(new Map(data.map(c => [c.id, `${c.firstName} ${c.firstLastName} — ${c.documentNumber}`]))),
    error: () => this.error.set('Error al cargar los clientes.')
  });

    const locId = ENV.locationId;
    if (locId) {
      this.locationService.getById(locId).subscribe({
        next:  (loc) => this.locationName.set(loc.name),
        error: ()    => this.locationName.set('Sede no encontrada')
      });
    }

    this.loadTrigger$.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.error.set('');
        return this.service.getAll().pipe(
          finalize(() => this.loading.set(false)),
          catchError(err => {
            this.error.set(err.error?.message ?? 'Error al cargar.');
            return EMPTY;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      if (this.excludeId) {
        this.items.set(data.filter((i: CustomerDiscount) => i.id !== this.excludeId));
        this.excludeId = '';
      } else {
        this.items.set(data);
      }
    });

    this.load();

    this.refreshService.onRefresh$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.load());
  }

  protected discountName(id: string): string  { return this.discountMap().get(id) ?? '—'; }
  protected clientName(id: string): string    { return this.clientMap().get(id)   ?? '—'; }
  protected discountActive(id: string): boolean { return this.discountActiveMap().get(id) ?? true; }

  load(): void { this.loadTrigger$.next(); }

  delete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  protected confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id) return;
    this.confirmDeleteId.set(null);
    this.items.update(list => list.filter(i => i.id !== id));
    this.service.delete(id).subscribe({
      error: () => { this.error.set('Error al eliminar.'); this.load(); }
    });
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

protected readonly filteredItems = computed(() => {
  let list = this.filterPipe.transform(this.items(), this.search(), this.discountMap(), this.clientMap());

  if (this.expiryFilter() !== 'all') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30  = new Date(today); in30.setDate(today.getDate() + 30);
    list = list.filter(i => {
      if (!i.endDate) return this.expiryFilter() === 'vigente';
      const end = new Date(i.endDate);
      switch (this.expiryFilter()) {
        case 'vigente':    return end >= today;
        case 'por_vencer': return end >= today && end <= in30;
        case 'vencido':    return end <  today;
        default:           return true;
      }
    });
  }

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

  onExpiryFilter(v: string): void { this.expiryFilter.set(v as any); this.currentPage.set(1); }
  clearFilters(): void { this.search.set(''); this.sortBy.set(''); this.expiryFilter.set('all'); this.currentPage.set(1); }

  protected truncate(text: string, max = 50): string {
    return text && text.length > max ? text.slice(0, max) + '...' : (text ?? '');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}