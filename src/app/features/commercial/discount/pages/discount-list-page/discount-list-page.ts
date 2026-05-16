import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';

@Component({
  selector: 'app-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './discount-list-page.html',
  styleUrl: './discount-list-page.css'
})
export class DiscountListPage implements OnInit {
  private readonly discountService = inject(DiscountService);
  private readonly router = inject(Router);

  discounts = signal<Discount[]>([]);
  loading = signal(false);
  error = signal('');
  currentPage = signal(1);
  search = signal('');
  sortBy = signal<'createdAt' | 'modifiedAt' | 'inactive' | ''>('');
  readonly pageSize = 5;

  ngOnInit(): void {
    this.loadDiscounts();
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter((e: any) => e.urlAfterRedirects === '/commercial/discount')
    ).subscribe(() => this.loadDiscounts());
  }

  loadDiscounts(): void {
    this.loading.set(true);
    this.error.set('');
    this.discountService.getAll().subscribe({
      next: (data) => {
        this.discounts.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar los descuentos.');
        this.loading.set(false);
      }
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar este descuento?')) return;
    this.discountService.delete(id).subscribe({
      next: () => {
        this.discounts.update(list => list.filter(d => d.id !== id));
      },
      error: () => this.error.set('Error al eliminar.')
    });
  }

  toggleStatus(id: string, current: boolean): void {
    this.discountService.updateStatus(id, { status: !current }).subscribe({
      next: () => {
        this.discounts.update(list =>
          list.map(d => d.id === id ? { ...d, status: !current } : d)
        );
      },
      error: () => this.error.set('Error al cambiar estado.')
    });
  }
  get filteredDiscounts(): Discount[] {
    const q = this.search().toLowerCase().trim();
    let list = q
      ? this.discounts().filter(d =>
          d.description.toLowerCase().includes(q) ||
          String(d.percentage).includes(q))
      : [...this.discounts()];

    switch (this.sortBy()) {
      case 'createdAt':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'modifiedAt':
        list.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
        break;
      case 'inactive':
        list.sort((a, b) => Number(a.status) - Number(b.status));
        break;
    }
    return list;
  }

  get paginatedDiscounts(): Discount[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredDiscounts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredDiscounts.length / this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage.set(page);
  }
  get totalActive(): number { return this.discounts().filter(d => d.status).length; }
  get totalInactive(): number { return this.discounts().filter(d => !d.status).length; }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }
  onSort(value: string): void {
  this.sortBy.set(value as any);
  this.currentPage.set(1);
}
}