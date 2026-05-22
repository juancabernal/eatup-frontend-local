import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter, retry } from 'rxjs/operators';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';
import { ENV } from '@config/env.config';
import { DiscountFilterPipe } from '@commercial/discount/pipes/discount-filter.pipe';
import { DiscountStatusBadgeComponent } from '@commercial/discount/components/discount-status-badge/discount-status-badge';

interface Category { id: string; name: string; status: string; }

@Component({
  selector: 'app-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DiscountFilterPipe, DiscountStatusBadgeComponent],
  templateUrl: './discount-list-page.html',
  styleUrl: './discount-list-page.css'
})
export class DiscountListPage implements OnInit {
  private readonly discountService = inject(DiscountService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private excludeId = '';

  private readonly categoriesUrl = `${ENV.apiUrl.replace('/api/v1', '')}/inventory/api/v1/categories/subtype/descuento`;

  discounts   = signal<Discount[]>([]);
  categoryMap = signal<Map<string, string>>(new Map());
  loading     = signal(false);
  error       = signal('');
  currentPage = signal(1);
  search      = signal('');
  sortBy      = signal<'createdAt' | 'modifiedAt' | 'inactive' | ''>('');
  readonly pageSize = 5;

  private readonly filterPipe = new DiscountFilterPipe();

  ngOnInit(): void {
    this.http.get<Category[]>(this.categoriesUrl).subscribe({
      next: (data) => this.categoryMap.set(new Map(data.map(c => [c.id, c.name])))
    });

    this.excludeId = history.state?.deletedId ?? '';
    this.loadDiscounts();

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter((e: any) => e.urlAfterRedirects === '/commercial/discount')
    ).subscribe(() => setTimeout(() => this.loadDiscounts(), 800));
  }

  categoryName(id: string): string {
    return this.categoryMap().get(id) ?? 'Sin categoría';
  }

  loadDiscounts(): void {
    this.loading.set(true);
    this.error.set('');
    this.discountService.getAll().pipe(
      retry({ count: 2, delay: 800 })
    ).subscribe({
      next: (data) => {
        const list = this.excludeId ? data.filter(d => d.id !== this.excludeId) : data;
        this.discounts.set(list);
        this.loading.set(false);
      },
      error: (err) => { this.error.set(err.error?.message ?? 'Error al cargar.'); this.loading.set(false); }
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar este descuento?')) return;
    this.discounts.update(list => list.filter(d => d.id !== id));
    this.discountService.delete(id).subscribe({
      error: () => { this.error.set('Error al eliminar.'); this.loadDiscounts(); }
    });
  }

  toggleStatus(id: string, current: boolean): void {
    this.discounts.update(list => list.map(d => d.id === id ? { ...d, status: !current } : d));
    this.discountService.updateStatus(id, { status: !current }).subscribe({
      error: () => this.discounts.update(list => list.map(d => d.id === id ? { ...d, status: current } : d))
    });
  }

  get filteredDiscounts(): Discount[] {
    let list = this.filterPipe.transform(this.discounts(), this.search(), this.categoryMap());

    switch (this.sortBy()) {
      case 'createdAt':  list = [...list].sort((a, b) => new Date(b.createdAt).getTime()  - new Date(a.createdAt).getTime()); break;
      case 'modifiedAt': list = [...list].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()); break;
      case 'inactive':   list = [...list].sort((a, b) => Number(a.status) - Number(b.status)); break;
    }
    return list;
  }

  get paginatedDiscounts(): Discount[]  { const s = (this.currentPage() - 1) * this.pageSize; return this.filteredDiscounts.slice(s, s + this.pageSize); }
  get totalPages(): number               { return Math.ceil(this.filteredDiscounts.length / this.pageSize); }
  get totalActive(): number              { return this.discounts().filter(d => d.status).length; }
  get totalInactive(): number            { return this.discounts().filter(d => !d.status).length; }

  goToPage(page: number): void  { if (page >= 1 && page <= this.totalPages) this.currentPage.set(page); }
  onSearch(value: string): void { this.search.set(value); this.currentPage.set(1); }
  onSort(value: string): void   { this.sortBy.set(value as any); this.currentPage.set(1); }
}