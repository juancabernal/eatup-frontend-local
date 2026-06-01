import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, EMPTY, forkJoin, of, interval } from 'rxjs';
import { finalize, takeUntil, switchMap, catchError } from 'rxjs/operators';
import { CustomerDiscountService } from '@commercial/customer-discount/services/customer-discount';
import { CustomerDiscount } from '@commercial/customer-discount/models/customer-discount.model';
import { DiscountService } from '@commercial/discount/services/discount';
import { ClientService } from '@commercial/customer-discount/services/client';
import { LocationService } from '@commercial/customer-discount/services/location';
import { ENV } from '@config/env.config';
import { AuthService } from '@features/user/services/auth.service';
import { FormsModule } from '@angular/forms';
import { CustomerDiscountFilterPipe } from '@commercial/customer-discount/pipes/customer-discount-filter.pipe';
import { CustomerDiscountExpiryBadgeComponent } from '@commercial/customer-discount/components/customer-discount-expiry-badge/customer-discount-expiry-badge';
import { DiscountStatusBadgeComponent } from '@commercial/discount/components/discount-status-badge/discount-status-badge';
import { CustomerDiscountRefreshService } from '@commercial/customer-discount/services/customer-discount-refresh.service';
interface Toast { id: string; type: 'success' | 'error'; message: string; }

@Component({
  selector: 'app-customer-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, CustomerDiscountExpiryBadgeComponent, DiscountStatusBadgeComponent],
  templateUrl: './customer-discount-list-page.html',
  styleUrl: './customer-discount-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class CustomerDiscountListPage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
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

  protected readonly statsVigentes = computed(() => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return this.items().filter(i => !i.endDate || new Date(i.endDate) >= hoy).length;
});

protected readonly statsPorVencer = computed(() => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
  return this.items().filter(i => {
    if (!i.endDate) return false;
    const end = new Date(i.endDate);
    return end >= hoy && end <= en30;
  }).length;
});

protected readonly statsVencidos = computed(() => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return this.items().filter(i => !!i.endDate && new Date(i.endDate) < hoy).length;
});
  protected readonly error        = signal('');
  protected readonly currentPage  = signal(1);
  protected readonly pageSize        = signal(5);
  protected readonly pageSizeOptions = [5, 10, 20];
  protected readonly search       = signal('');
  protected readonly sortBy       = signal<'assignedAt' | 'startDate' | 'endDate' | ''>('');
  protected readonly expiryFilter = signal<'all' | 'vigente' | 'por_vencer' | 'vencido'>('all');
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly toasts = signal<Toast[]>([]);

  private readonly filterPipe = new CustomerDiscountFilterPipe();
  private readonly destroy$ = new Subject<void>();
  private readonly loadTrigger$ = new Subject<void>();

  ngOnInit(): void {
    this.excludeId = history.state?.deletedId ?? '';

    const locId = this.authService.getLocationId() || ENV.locationId;
    forkJoin([

      this.discountService.getAll(),
      this.clientService.getAll(),
      locId ? this.locationService.getById(locId) : of(null)
    ]).subscribe({
      next: ([discounts, clients, loc]) => {
        this.discountMap.set(
          new Map(discounts.map(d => [d.id, `${d.description} (${d.percentage}%)`]))
        );
        this.discountActiveMap.set(
          new Map(discounts.map(d => [d.id, d.status]))
        );
        this.clientMap.set(
          new Map(clients.map(c => [c.id, `${c.firstName} ${c.firstLastName} — ${c.documentNumber}`]))
        );
        if (loc) this.locationName.set(loc.name);
        else      this.locationName.set('—');
      },
      error: () => this.locationName.set('Error al cargar datos')
    });

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
      const locId = this.authService.getLocationId();
      let filtered = locId ? data.filter((i: CustomerDiscount) => i.locationId === locId) : data;
      if (this.excludeId) {
        filtered = filtered.filter((i: CustomerDiscount) => i.id !== this.excludeId);
        this.excludeId = '';
      }
      this.items.set(filtered);
    });

    this.load();

    this.refreshService.onRefresh$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.load());

      interval(30_000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (document.visibilityState === 'visible' && !this.loading()) {
        this.silentRefresh();
      }
    });
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
    next: () => this.showToast('success', 'Asignación eliminada correctamente.'),
    error: () => {
      this.showToast('error', 'No se pudo eliminar. Intenta de nuevo.');
      this.load();
    }
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
    Math.ceil(this.filteredItems().length / this.pageSize())
  );

  protected readonly paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  protected readonly rangeStart = computed(() =>
    this.filteredItems().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );
  protected readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredItems().length)
  );
  
  goToPage(page: number): void {
  if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }

  onSearch(value: string): void { this.search.set(value); this.currentPage.set(1); }

  onSort(value: string): void  { this.sortBy.set(value as any); this.currentPage.set(1); }

  onExpiryFilter(v: string): void { this.expiryFilter.set(v as any); this.currentPage.set(1); }
  clearFilters(): void { this.search.set(''); this.sortBy.set(''); this.expiryFilter.set('all'); this.currentPage.set(1); }
  onPageSize(value: string): void { this.pageSize.set(Number(value)); this.currentPage.set(1); }

  protected truncate(text: string, max = 50): string {
    return text && text.length > max ? text.slice(0, max) + '...' : (text ?? '');
  }

  protected showToast(type: 'success' | 'error', message: string): void {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}`;
    this.toasts.update(t => [...t, { id, type, message }]);
    setTimeout(() => this.removeToast(id), 4000);
  }

  protected removeToast(id: string): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }

  private silentRefresh(): void {
    const locId = this.authService.getLocationId();
    this.service.getAll().pipe(
      catchError(() => EMPTY)
    ).subscribe(data => {
      const filtered = locId ? data.filter((i: CustomerDiscount) => i.locationId === locId) : data;
      this.items.set(filtered);
    });
  }

  protected exportCsv(): void {
  const headers = ['Cliente', 'Descuento', 'Ubicación', 'Asignado', 'Inicio', 'Vencimiento'];
  const rows = this.filteredItems().map(i => [
    this.clientName(i.customerId),
    this.discountName(i.discountId),
    this.locationName(),
    i.assignedAt ?? '—',
    i.startDate  ?? '—',
    i.endDate    ?? '—'
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  a.download = `descuentos-cliente-${fecha}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  this.showToast('success', 'CSV exportado correctamente.');
}

@HostListener('document:keydown.escape')
protected onEscape(): void {
  if (this.confirmDeleteId()) this.cancelDelete();
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}