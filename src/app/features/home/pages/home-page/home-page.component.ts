import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface QuickAccessCard {
  icon: string;
  title: string;
  description: string;
  path: string;
  accent: 'orange' | 'green';
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePageComponent {
  protected readonly quickAccessCards: QuickAccessCard[] = [
    {
      icon: '🧾',
      title: 'Ventas',
      description: 'Registra órdenes, consulta el carrito y controla las ventas del día.',
      path: '/commercial/sales',
      accent: 'green'
    },
    {
      icon: '🍲',
      title: 'Recetas',
      description: 'Administra preparaciones, precios y disponibilidad del menú.',
      path: '/inventory/recipes',
      accent: 'orange'
    },
    {
      icon: '📦',
      title: 'Productos',
      description: 'Consulta y actualiza los insumos disponibles en inventario.',
      path: '/inventory/product',
      accent: 'green'
    },
    {
      icon: '🏷️',
      title: 'Categorías',
      description: 'Organiza productos y recetas para mantener el catálogo claro.',
      path: '/inventory/categories',
      accent: 'orange'
    },
    {
      icon: '📍',
      title: 'Sedes',
      description: 'Gestiona ubicaciones operativas y puntos de atención.',
      path: '/inventor/locations',
      accent: 'green'
    },
    {
      icon: '🔄',
      title: 'Transferencias',
      description: 'Revisa movimientos entre sedes y trazabilidad de inventario.',
      path: '/inventory/transfer',
      accent: 'orange'
    },
    {
      icon: '💳',
      title: 'Pagos',
      description: 'Accede a comprobantes de caja, facturas y métodos de pago.',
      path: '/payment/cashreceipt',
      accent: 'green'
    }
  ];
}
