import { Routes } from '@angular/router';

export const TRANSFER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/transfer-list-page/transfer-list-page.component').then(
        m => m.TransferListPageComponent
      )
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./pages/transfer-create-page/transfer-create-page.component').then(
        m => m.TransferCreatePageComponent
      )
  }
];
