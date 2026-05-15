import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';

@Component({
  selector: 'app-discount-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './discount-detail-page.html',
  styleUrl: './discount-detail-page.css'
})
export class DiscountDetailPage implements OnInit {
  private readonly discountService = inject(DiscountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  discount = signal<Discount | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.discountService.getById(id).subscribe({
      next: (data) => {
        this.discount.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el descuento.');
        this.loading.set(false);
      }
    });
  }
    delete(): void {
    if (!confirm('¿Eliminar este descuento?')) return;
    this.discountService.delete(this.discount()!.id).subscribe({
      next: () => this.router.navigate(['/commercial/discount']),
      error: () => alert('Error al eliminar.')
    });
  }
}