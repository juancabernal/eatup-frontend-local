import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '@commercial/discount/services/category';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';
import { ENV } from '@config/env.config';


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
  private readonly categoryService = inject(CategoryService);

  discount     = signal<Discount | null>(null);
  categoryName = signal('—');
  loading      = signal(true);
  error        = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.discountService.getById(id).subscribe({
      next: (data) => {
        this.discount.set(data);
        this.loading.set(false);
        this.fetchCategoryName(data.categoryId);
      },
      error: () => {
        this.error.set('Este descuento ya no existe.');
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/commercial/discount']), 1500);
      }
    });
  }

  private fetchCategoryName(categoryId: string): void {
    this.categoryService.getAll().subscribe({
      next: (data) => {
        const cat = data.find(c => c.id === categoryId);
        this.categoryName.set(cat?.name ?? 'Sin categoría');
      },
      error: () => this.categoryName.set('Sin categoría')
    });
  }

  delete(): void {
    if (!confirm('¿Eliminar este descuento?')) return;
    const id = this.discount()!.id;
    this.discountService.delete(id).subscribe({
      next:  () => this.router.navigate(['/commercial/discount'], { state: { deletedId: id } }),
      error: () => alert('Error al eliminar.')
    });
  }
}