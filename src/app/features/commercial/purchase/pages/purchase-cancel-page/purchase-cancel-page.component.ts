import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PurchaseService } from '../../services/purchase.service';
import { PurchaseResponse } from '../../models/purchase.model';
import { ENV } from '@config/env.config';

@Component({
  selector: 'app-purchase-cancel-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="purchase-page">
      <header class="page-header">
              <div>
                <button class="btn-link" (click)="goBack()">
                  ← Volver
                </button>
                <h1>Cancelar compra</h1>
              </div>
            </header>

            <section class="card cancel-card">
              @if (purchase()) {
                <p>Orden: <strong>{{ purchase()?.orderNumber }}</strong> - Estado: <span class="badge" [ngClass]="statusClassMap[purchase()!.status]">{{ purchase()?.status | uppercase }}</span></p>
              }
      <div class="field">
          <label>Motivo (Opcional)</label>
          <textarea [(ngModel)]="reason" rows="5"></textarea>
        </div>

        <div class="actions">
          <button class="btn-secondary" (click)="router.navigate(['../../'], { relativeTo: route })">Volver</button>
          <button class="btn-danger" (click)="confirm()">Confirmar cancelación</button>
        </div>
      </section>

    </div>
  `,
  styleUrl: 'purchase-cancel-page.component.css'
})

export class PurchaseCancelPageComponent implements OnInit {
  purchase = signal<PurchaseResponse | null>(null);

  statusClassMap: Record<string, string> = { CREATED: 'badge-gray', APPROVED: 'badge-yellow', RECEIVED: 'badge-green', CANCELLED: 'badge-red' };
  private locationId = ENV.locationId;

  reason = '';

  constructor(public route: ActivatedRoute, public router: Router, private purchaseService: PurchaseService) {}

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.purchaseService.getPurchaseById(this.locationId, id).subscribe((p) => this.purchase.set(p));
  }

  confirm(): void {

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.purchaseService.updateStatus(this.locationId, id, { status: 'CANCELLED', cancelReason: this.reason.trim() }).subscribe(() => this.goBack());
  }

  goBack(): void {
    this.router.navigate(['/commercial/purchases']);
  }
}