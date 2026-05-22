import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClientService } from '@commercial/customer-discount/services/client';
import { LocationService } from '@commercial/customer-discount/services/location';
import { CustomerDiscountService } from '@commercial/customer-discount/services/customer-discount';
import { CustomerDiscount } from '@commercial/customer-discount/models/customer-discount.model';
import { DiscountService } from '@commercial/discount/services/discount';
import { ENV } from '@config/env.config';


@Component({
  selector: 'app-customer-discount-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './customer-discount-detail-page.html',
  styleUrl: './customer-discount-detail-page.css'
})
export class CustomerDiscountDetailPage implements OnInit {
  private readonly service         = inject(CustomerDiscountService);
  private readonly discountService = inject(DiscountService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly clientService   = inject(ClientService);
  private readonly locationService = inject(LocationService);


  item         = signal<CustomerDiscount | null>(null);
  discountName = signal('—');
  clientName   = signal('—');
  locationName = signal('—');
  loading      = signal(true);
  error        = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';

    this.service.getById(id).subscribe({
      next: (data) => {
        this.item.set(data);
        this.loading.set(false);
        this.loadNames(data);
      },
      error: () => {
        this.error.set('Esta asignación ya no existe.');
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/commercial/customer-discount']), 1500);
      }
    });
  }
  
private loadNames(data: CustomerDiscount): void {
  this.discountService.getById(data.discountId).subscribe({
    next: (d) => this.discountName.set(`${d.description} (${d.percentage}%)`),
    error: ()  => this.discountName.set('Descuento no encontrado')
  });

  this.clientService.getAll().subscribe({
    next: (clients) => {
      const c = clients.find(c => c.id === data.customerId);
      this.clientName.set(c ? `${c.firstName} ${c.firstLastName}` : '—');
    }
  });

  const locId = ENV.locationId;
  if (locId) {
    this.locationService.getById(locId).subscribe({
      next:  (loc) => this.locationName.set(loc.name),
      error: ()    => this.locationName.set('Sede no encontrada')
    });
  }
}

  delete(): void {
    if (!confirm('¿Eliminar esta asignación?')) return;
    const id = this.item()!.id;
    this.service.delete(id).subscribe({
      next:  () => this.router.navigate(['/commercial/customer-discount'], { state: { deletedId: id } }),
      error: () => alert('Error al eliminar.')
    });
  }
}