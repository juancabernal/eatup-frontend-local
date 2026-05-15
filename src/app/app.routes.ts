import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout.component';

/**
 * Rutas principales de la aplicación.
 *
 * Patrón para agregar nuevas features:
 *  1. Crea el archivo de rutas en features/<module>/<feature>/<feature>.routes.ts
 *  2. Agrega un nuevo path con loadChildren apuntando a ese archivo.
 *  3. Actualiza el LayoutComponent para mostrar el enlace en el sidebar.
 */
export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'payment/cashreceipt',
        pathMatch: 'full'
      },
      {
        path: 'payment/cashreceipt',
        loadChildren: () =>
          import('./features/payment/cashreceipt/cashreceipt.routes').then(
            m => m.CASH_RECEIPT_ROUTES
          )
      },
      {
        path: 'payment/invoice',
        loadChildren: () =>
          import('./features/payment/invoice/invoice.routes').then(
            m => m.INVOICE_ROUTES
          )
      },
      {
        path: 'payment/paymentmethod',
        loadChildren: () =>
          import('./features/payment/paymentmethod/paymentmethod.routes').then(
            m => m.PAYMENT_METHOD_ROUTES
          )
      },

      {
        path: 'commercial/sales',
        loadChildren: () =>
          import('./features/commercial/sales/sales.routes').then(
            m => m.SALES_ROUTES
          )
      },
      {
        path: 'commercial/discount',
         loadChildren: () =>
          import('./features/commercial/discount/discount.routes')
            .then(m => m.DISCOUNT_ROUTES)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
