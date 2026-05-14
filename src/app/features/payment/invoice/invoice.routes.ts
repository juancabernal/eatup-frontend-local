import { Routes } from '@angular/router';

export const INVOICE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/invoice-placeholder/invoice-placeholder.component').then(
        m => m.InvoicePlaceholderComponent
      )
  }
];
