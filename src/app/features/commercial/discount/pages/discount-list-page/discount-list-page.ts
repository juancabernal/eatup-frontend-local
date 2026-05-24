import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { filter, retry, finalize, takeUntil } from 'rxjs/operators';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '@commercial/discount/services/category';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';
import { DiscountFilterPipe } from '@commercial/discount/pipes/discount-filter.pipe';
import { DiscountStatusBadgeComponent } from '@commercial/discount/components/discount-status-badge/discount-status-badge';


@Component({
  selector: 'app-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DiscountStatusBadgeComponent],
  templateUrl: './discount-list-page.html',
  styleUrl: './discount-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscountListPage implements OnInit, OnDestroy {
  private readonly discountService = inject(DiscountService);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);

  protected readonly discounts   = signal<Discount[]>([]);
  protected readonly categoryMap = signal<Map<string, string>>(new Map());
  protected readonly loading     = signal(false);
  protected readonly error       = signal('');
  protected readonly currentPage = signal(1);
  protected readonly search      = signal('');
  protected readonly sortBy      = signal<'createdAt' | 'modifiedAt' | 'inactive' | ''>('');
  protected readonly pageSize    = 5;

  private readonly filterPipe = new DiscountFilterPipe();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.categoryService.getAll().subscribe({
      next: (data) => this.categoryMap.set(new Map(data.map(c => [c.id, c.name])))
    });

        this.loadDiscounts();

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter((e: any) => e.urlAfterRedirects === '/commercial/discount'),
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadDiscounts());
  }

  categoryName(id: string): string {
    return this.categoryMap().get(id) ?? 'Sin categoría';
  }

  loadDiscounts(): void {
    this.loading.set(true);
    this.error.set('');
    this.discountService.getAll().pipe(
      retry({ count: 2, delay: 800 }),
      finalize(() => this.loading.set(false))
    ).subscribe({
            next: (data) => this.discounts.set(data),
      error: (err) => this.error.set(err.error?.message ?? 'Error al cargar.')
    });
  }

  toggleStatus(id: string, current: boolean): void {
    this.discounts.update(list => list.map(d => d.id === id ? { ...d, status: !current } : d));
    this.discountService.updateStatus(id, { status: !current }).subscribe({
      error: () => this.discounts.update(list => list.map(d => d.id === id ? { ...d, status: current } : d))
    });
  }

protected readonly filteredDiscounts = computed(() => {
  let list = this.filterPipe.transform(this.discounts(), this.search(), this.categoryMap());
  switch (this.sortBy()) {
    case 'createdAt':  list = [...list].sort((a, b) => new Date(b.createdAt).getTime()  - new Date(a.createdAt).getTime()); break;
    case 'modifiedAt': list = [...list].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()); break;
    case 'inactive':   list = [...list].sort((a, b) => Number(a.status) - Number(b.status)); break;
  }
  return list;
});

protected readonly totalPages = computed(() =>
  Math.ceil(this.filteredDiscounts().length / this.pageSize)
);

protected readonly paginatedDiscounts = computed(() => {
  const s = (this.currentPage() - 1) * this.pageSize;
  return this.filteredDiscounts().slice(s, s + this.pageSize);
});

protected readonly totalActive   = computed(() => this.discounts().filter(d => d.status).length);
protected readonly totalInactive = computed(() => this.discounts().filter(d => !d.status).length);

goToPage(page: number): void  { if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page); }
onSearch(value: string): void { this.search.set(value); this.currentPage.set(1); }
onSort(value: string): void   { this.sortBy.set(value as any); this.currentPage.set(1); }

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
}