import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { DiscountService } from '@commercial/discount/services/discount';
import { Discount } from '@commercial/discount/models/discount.model';
import { ENV } from '@config/env.config';

interface Category {
  id: string;
  name: string;
  status: string;
}

@Component({
  selector: 'app-discount-form-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './discount-form-page.html',
  styleUrl: './discount-form-page.css'
})
export class DiscountFormPage implements OnInit {
  private readonly discountService = inject(DiscountService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly categoriesUrl = `${ENV.apiUrl.replace('/api/v1', '')}/inventory/api/v1/categories/subtype/descuento`;

  isEditing = signal(false);
  submitting = signal(false);
  categories = signal<Category[]>([]);

  categoryId = '';
  percentage = 0;
  description = '';

  private discountId = '';

  errors = { categoryId: '', percentage: '', description: '', general: '' };

  ngOnInit(): void {
    this.http.get<Category[]>(this.categoriesUrl).subscribe({
      next: (data) => this.categories.set(data.filter(c => c.status === 'ACTIVE'))
    });

    this.discountId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.discountId) {
      this.isEditing.set(true);
      this.loadDiscount();
    }
  }

  loadDiscount(): void {
    this.discountService.getById(this.discountId).subscribe({
      next: (data: Discount) => {
        this.categoryId = data.categoryId;
        this.percentage = data.percentage;
        this.description = data.description;
      },
      error: () => this.errors.general = 'Error al cargar el descuento.'
    });
  }

  onPercentageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseInt(input.value, 10);
    if (isNaN(val)) { this.percentage = 0; return; }
    if (val > 100) val = 100;
    if (val < 1) val = 1;
    this.percentage = val;
    input.value = String(val);
  }

  save(): void {
    if (this.submitting()) return;
    this.errors = { categoryId: '', percentage: '', description: '', general: '' };

    let valid = true;
    if (!this.categoryId) { this.errors.categoryId = 'Selecciona una categoría.'; valid = false; }
    if (!this.percentage || this.percentage < 1 || this.percentage > 100) { this.errors.percentage = 'El porcentaje debe estar entre 1 y 100.'; valid = false; }
    if (!this.description.trim()) { this.errors.description = 'La descripción es obligatoria.'; valid = false; }
    else if (this.description.trim().length < 5) { this.errors.description = 'La descripción debe tener mínimo 5 caracteres.'; valid = false; }
    else if (this.description.trim().length > 100) { this.errors.description = 'La descripción no puede superar 100 caracteres.'; valid = false; }
    if (!valid) return;

    this.submitting.set(true);

    const form = {
      categoryId: this.categoryId,
      percentage: this.percentage,
      description: this.description.trim()
    };

    const request$ = this.isEditing()
      ? this.discountService.update(this.discountId, form)
      : this.discountService.create(form);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        setTimeout(() => this.router.navigate(['/commercial/discount']), 500);
      },
      error: (err) => {
        this.submitting.set(false);
        const body = err.error;
        if (body?.errors?.length) {
          body.errors.forEach((e: string) => {
            if (e.includes('percentage')) this.errors.percentage = 'El porcentaje debe estar entre 1 y 100.';
            else if (e.includes('categoryId')) this.errors.categoryId = 'La categoría es obligatoria.';
            else if (e.includes('description')) this.errors.description = 'La descripción no es válida.';
            else this.errors.general = body.message ?? 'Error al guardar.';
          });
        } else {
          this.errors.general = body?.message ?? 'Error al guardar el descuento.';
        }
      }
    });
  }
}