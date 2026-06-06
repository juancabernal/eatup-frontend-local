import { Component, inject, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface NavigationOption {
  title: string;
  description: string;
  path: string;
  keywords: string[];
  icon: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <div class="header-left">
        <!-- Hamburger Menu for mobile & toggle sidebar -->
        <button class="btn-hamburger" (click)="toggleSidebar.emit()" title="Menú">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <!-- Dynamic Breadcrumb -->
        <div class="breadcrumb">
          <span class="breadcrumb-prefix">EatUp</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentPath() }}</span>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-container">
        <div class="search-wrapper">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.603 10.603z" />
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar funciones, ventas, productos..."
            aria-label="Buscar"
            [value]="searchTerm()"
            (input)="handleSearchInput($event)"
            (focus)="openSearchResults()"
            (keydown)="handleSearchKeydown($event)"
            (blur)="scheduleCloseSearchResults()"
          />
          <span class="search-shortcut">⌘K</span>

          @if (isSearchOpen() && searchTerm().trim().length > 0) {
            <div class="search-results" role="listbox" aria-label="Resultados de búsqueda">
              @if (filteredNavigationOptions().length > 0) {
                @for (option of filteredNavigationOptions(); track option.path) {
                  <button
                    type="button"
                    class="search-result"
                    role="option"
                    (mousedown)="$event.preventDefault()"
                    (click)="navigateToOption(option)"
                  >
                    <span class="result-icon">{{ option.icon }}</span>
                    <span class="result-copy">
                      <strong>{{ option.title }}</strong>
                      <small>{{ option.description }}</small>
                    </span>
                    <span class="result-arrow">→</span>
                  </button>
                }
              } @else {
                <div class="search-empty">Sin resultados</div>
              }
            </div>
          }
        </div>
      </div>

      <!-- User Profile & Actions -->
      <div class="user-profile">
        <button class="btn-user" type="button" (click)="openProfile.emit()" title="Ver Perfil">
          <span class="avatar-icon">👤</span>
          <span class="user-name">Mi perfil</span>
        </button>
        
        <button class="btn-logout" (click)="confirmLogout.emit()" title="Cerrar Sesión">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 logout-icon-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span class="logout-text">Cerrar sesión</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .top-bar {
      height: 64px;
      background-color: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      flex-shrink: 0;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-hamburger {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-hamburger:hover {
      background-color: #f1f5f9;
      color: #1e293b;
    }

    .btn-hamburger svg {
      width: 20px;
      height: 20px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748b;
    }

    .breadcrumb-prefix {
      color: #94a3b8;
    }

    .breadcrumb-separator {
      color: #cbd5e1;
    }

    .breadcrumb-current {
      color: #1e293b;
      font-weight: 600;
    }

    /* Search Bar Styling */
    .search-container {
      flex: 1;
      max-width: 430px;
      margin: 0 1.5rem;
      position: relative;
      z-index: 80;
    }

    .search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      width: 18px;
      height: 18px;
      color: #94a3b8;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 38px;
      padding: 0.5rem 2.5rem 0.5rem 2.25rem;
      font-size: 0.875rem;
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 0.5rem;
      color: #1e293b;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      background-color: #ffffff;
      border-color: #ff6b35;
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.15);
    }

    .search-shortcut {
      position: absolute;
      right: 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #94a3b8;
      background-color: #e2e8f0;
      padding: 0.15rem 0.35rem;
      border-radius: 0.25rem;
      pointer-events: none;
    }

    .search-results {
      position: absolute;
      top: calc(100% + 0.5rem);
      left: 0;
      right: 0;
      max-height: 340px;
      overflow-y: auto;
      padding: 0.45rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.85rem;
      background: #ffffff;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
    }

    .search-result {
      width: 100%;
      border: 0;
      background: transparent;
      color: #0f172a;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.65rem;
      padding: 0.65rem;
      border-radius: 0.65rem;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .search-result:hover,
    .search-result:focus-visible {
      outline: none;
      background: #fff3ed;
    }

    .result-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 0.6rem;
      background: #f8fafc;
      font-size: 1.05rem;
    }

    .result-copy {
      min-width: 0;
      display: grid;
      gap: 0.12rem;
    }

    .result-copy strong {
      font-size: 0.88rem;
      line-height: 1.2;
    }

    .result-copy small {
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-arrow {
      color: #ff6b35;
      font-weight: 800;
    }

    .search-empty {
      padding: 0.85rem;
      color: #64748b;
      text-align: center;
      font-size: 0.88rem;
    }

    /* User Profile Styles */
    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .btn-user {
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      color: #334155;
      border-radius: 9999px;
      padding: 0.4rem 0.85rem;
      font-size: 0.8125rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-user:hover {
      background-color: #f8fafc;
      border-color: #cbd5e1;
      color: #0f172a;
    }

    .avatar-icon {
      font-size: 0.875rem;
    }

    .btn-logout {
      background: none;
      border: 1.5px solid #ff6b35;
      color: #ff6b35;
      border-radius: 0.5rem;
      padding: 0.4rem 0.85rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }

    .btn-logout:hover {
      background-color: #ff6b35;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
    }

    .logout-icon-svg {
      width: 14px;
      height: 14px;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .search-container {
        display: none; /* Hide search bar on tablets & mobile to save space */
      }
      .user-name, .logout-text {
        display: none; /* Icon/avatar only on small screens */
      }
      .btn-user, .btn-logout {
        padding: 0.5rem;
        border-radius: 50%;
        width: 34px;
        height: 34px;
        justify-content: center;
      }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routerSubscription?: Subscription;
  private blurTimeout?: ReturnType<typeof setTimeout>;

  protected readonly currentPath = signal<string>('Dashboard');
  protected readonly searchTerm = signal<string>('');
  protected readonly isSearchOpen = signal<boolean>(false);

  protected readonly navigationOptions: NavigationOption[] = [
    {
      title: 'Inicio',
      description: 'Menú principal y accesos rápidos',
      path: '/home',
      keywords: ['menu', 'menú', 'dashboard', 'inicio', 'home'],
      icon: '🏠'
    },
    {
      title: 'Ventas',
      description: 'Registro y gestión de ventas',
      path: '/commercial/sales',
      keywords: ['ventas', 'sales', 'ordenes', 'órdenes'],
      icon: '🧾'
    },
    {
      title: 'Recetas',
      description: 'Administración de recetas del menú',
      path: '/inventory/recipes',
      keywords: ['recetas', 'recipes', 'menu', 'menú'],
      icon: '🍲'
    },
    {
      title: 'Productos',
      description: 'Catálogo de productos de inventario',
      path: '/inventory/product',
      keywords: ['productos', 'product', 'inventario', 'stock'],
      icon: '📦'
    },
    {
      title: 'Categorías',
      description: 'Categorías de inventario',
      path: '/inventory/categories',
      keywords: ['categorias', 'categorías', 'categories'],
      icon: '🏷️'
    },
    {
      title: 'Sedes',
      description: 'Ubicaciones y sedes operativas',
      path: '/inventor/locations',
      keywords: ['sedes', 'locations', 'ubicaciones', 'locales'],
      icon: '📍'
    },
    {
      title: 'Transferencias',
      description: 'Movimientos y transferencias de inventario',
      path: '/inventory/transfer',
      keywords: ['transferencias', 'transfer', 'movimientos'],
      icon: '🔄'
    },
    {
      title: 'Comprobantes de caja',
      description: 'Pagos y recibos de caja',
      path: '/payment/cashreceipt',
      keywords: ['payment', 'pagos', 'cash', 'receipt', 'caja', 'recibos'],
      icon: '💳'
    },
    {
      title: 'Facturas',
      description: 'Consulta de facturación',
      path: '/payment/invoice',
      keywords: ['facturas', 'invoice', 'facturación', 'facturacion'],
      icon: '📄'
    },
    {
      title: 'Métodos de pago',
      description: 'Configuración de métodos de pago',
      path: '/payment/paymentmethod',
      keywords: ['metodos', 'métodos', 'payment method', 'pagos'],
      icon: '💰'
    },
    {
      title: 'Mesas',
      description: 'Dashboard de mesas, reservas y sesiones',
      path: '/commercial/tables',
      keywords: ['mesas', 'reservas', 'sesiones', 'tables'],
      icon: '🪑'
    },
    {
      title: 'Reservas',
      description: 'Reservas de mesas',
      path: '/commercial/tables/reservations',
      keywords: ['reservas', 'reservations', 'mesas'],
      icon: '📅'
    },
    {
      title: 'Sesiones',
      description: 'Sesiones de mesas',
      path: '/commercial/tables/sessions',
      keywords: ['sesiones', 'sessions', 'mesas'],
      icon: '⏱️'
    }
  ];

  readonly toggleSidebar = output<void>();
  readonly openProfile = output<void>();
  readonly confirmLogout = output<void>();

  protected filteredNavigationOptions(): NavigationOption[] {
    const term = this.normalize(this.searchTerm());
    if (!term) return [];

    return this.navigationOptions
      .filter(option => this.optionMatches(option, term))
      .slice(0, 7);
  }

  protected handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    this.isSearchOpen.set(true);
  }

  protected openSearchResults(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.isSearchOpen.set(true);
  }

  protected scheduleCloseSearchResults(): void {
    this.blurTimeout = setTimeout(() => this.isSearchOpen.set(false), 120);
  }

  protected handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isSearchOpen.set(false);
      return;
    }

    if (event.key === 'Enter') {
      const firstResult = this.filteredNavigationOptions()[0];
      if (firstResult) {
        event.preventDefault();
        this.navigateToOption(firstResult);
      }
    }
  }

  protected navigateToOption(option: NavigationOption): void {
    this.searchTerm.set('');
    this.isSearchOpen.set(false);
    void this.router.navigateByUrl(option.path);
  }

  ngOnInit(): void {
    this.updatePath(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        this.updatePath((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
  }

  private updatePath(url: string): void {
    // Split URL and filter empty parts
    const parts = url.split('/').filter(p => p && !p.startsWith('?'));
    if (parts.length === 0) {
      this.currentPath.set('Dashboard');
      return;
    }

    // Map segments to human-readable names
    const segmentMap: Record<string, string> = {
      'home': 'Inicio',
      'payment': 'Payment',
      'cashreceipt': 'Cash Receipt',
      'invoice': 'Facturas',
      'paymentmethod': 'Payment Method',
      'commercial': 'Commercial',
      'discount': 'Descuentos',
      'customer-discount': 'Descuentos por Cliente',
      'clients': 'Clientes',
      'provider': 'Proveedores',
      'seller': 'Vendedores',
      'purchases': 'Compras',
      'tables': 'Mesas',
      'reservations': 'Reservas',
      'sessions': 'Sesiones',
      'sales': 'Ventas',
      'inventory': 'Inventory',
      'transfer': 'Transfer',
      'categories': 'Categorías',
      'product': 'Productos',
      'recipes': 'Recetas',
      'locations': 'Sedes',
      'inventor': 'Inventory' // handle path typo if any
    };

    const breadcrumbs = parts.map(part => segmentMap[part.toLowerCase()] || part);
    this.currentPath.set(breadcrumbs.join(' / '));
  }

  private optionMatches(option: NavigationOption, normalizedTerm: string): boolean {
    const searchableContent = [
      option.title,
      option.description,
      option.path,
      ...option.keywords
    ].map(value => this.normalize(value)).join(' ');

    return searchableContent.includes(normalizedTerm);
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
