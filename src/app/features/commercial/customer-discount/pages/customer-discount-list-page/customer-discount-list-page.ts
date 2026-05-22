import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CustomerDiscountService } from '@commercial/customer-discount/services/customer-discount';
import { CustomerDiscount } from '@commercial/customer-discount/models/customer-discount.model';
import { DiscountService } from '@commercial/discount/services/discount';
import { ClientService } from '@commercial/customer-discount/services/client';
import { LocationService } from '@commercial/customer-discount/services/location';
import { ENV } from '@config/env.config';
import { FormsModule } from '@angular/forms';
import { CustomerDiscountFilterPipe } from '@commercial/customer-discount/pipes/customer-discount-filter.pipe';
import { CustomerDiscountExpiryBadgeComponent } from '@commercial/customer-discount/components/customer-discount-expiry-badge/customer-discount-expiry-badge';


@Component({
  selector: 'app-customer-discount-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, CustomerDiscountFilterPipe, CustomerDiscountExpiryBadgeComponent],
  templateUrl: './customer-discount-list-page.html',
  styleUrl: './customer-discount-list-page.css'
})

export class CustomerDiscountListPage implements OnInit {
  private readonly service         = inject(CustomerDiscountService);
  private readonly discountService = inject(DiscountService);
  private readonly clientService   = inject(ClientService);
  private readonly locationService = inject(LocationService);
  private readonly router          = inject(Router);
  private excludeId = '';


  items        = signal<CustomerDiscount[]>([]);
  discountMap  = signal<Map<string, string>>(new Map());
  clientMap    = signal<Map<string, string>>(new Map());
  locationName = signal('Cargando...');
  loading      = signal(false);
  error        = signal('');
  currentPage  = signal(1);
  readonly pageSize = 5;

  search      = signal('');

  private readonly filterPipe = new CustomerDiscountFilterPipe();

  ngOnInit(): void {
    this.excludeId = history.state?.deletedId ?? '';

    this.discountService.getAll().subscribe({
      next: (data) => this.discountMap.set(new Map(data.map(d => [d.id, `${d.description} (${d.percentage}%)`])))
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

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter((e: any) => e.urlAfterRedirects === '/commercial/customer-discount')
    ).subscribe(() => this.load());
  }

  discountName(id: string): string { return this.discountMap().get(id) ?? '—'; }
  clientName(id: string): string   { return this.clientMap().get(id)   ?? '—'; }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.getAll().subscribe({
      next: (data) => {
        const list = this.excludeId ? data.filter(i => i.id !== this.excludeId) : data;
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err)  => { this.error.set(err.error?.message ?? 'Error al cargar.'); this.loading.set(false); }
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar esta asignación?')) return;
    this.items.update(list => list.filter(i => i.id !== id));
    this.service.delete(id).subscribe({
      error: () => { this.error.set('Error al eliminar.'); this.load(); }
    });
  }

  get filteredItems(): CustomerDiscount[] {
    return this.filterPipe.transform(
      this.items(), this.search(), this.discountMap(), this.clientMap()
    );
  }

  get paginated(): CustomerDiscount[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.ceil(this.filteredItems.length / this.pageSize); }

  onSearch(value: string): void { this.search.set(value); this.currentPage.set(1); }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage.set(page);
  }
}