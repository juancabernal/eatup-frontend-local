import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@features/user/services/auth.service';
import { ProfilePanelComponent } from '@features/user/components/profile-panel/profile-panel.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ProfilePanelComponent],
  template: `
    <div class="layout-container">
      <aside class="sidebar">
        <div class="logo">
          <h2>EatUp</h2>
        </div>
        <nav class="nav-menu">
          @for (module of modules(); track module.name) {
            <div class="nav-section">
              <button class="section-title" (click)="toggleModule(module.name)" [attr.aria-expanded]="module.expanded">
                {{ module.name }}
                <span class="chevron" [class.rotated]="module.expanded">▼</span>
              </button>
              @if (module.expanded) {
                <ul class="nav-links">
                  @for (feature of module.features; track feature.path) {
                    <li>
                      <a [routerLink]="feature.path" routerLinkActive="active">
                        <i class="icon"></i> {{ feature.name }}
                      </a>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </nav>
      </aside>

      <main class="content">
        <header class="top-bar">
          <div class="breadcrumb">Dashboard</div>
          <div class="user-profile">
            <button class="btn-user" type="button" (click)="openUserPanel()">
              <span aria-hidden="true">👤</span>
              <span>Mi perfil</span>
            </button>
            <button class="btn-logout" (click)="confirmLogout()">Cerrar sesión</button>
          </div>
        </header>
        <section class="main-view">
          <router-outlet></router-outlet>
        </section>
      </main>

      @if (isUserPanelOpen()) {
        <app-profile-panel (panelClosed)="closeUserPanel()" />
      }

      <!-- Modal confirmación logout -->
      @if (showLogoutModal()) {
        <div class="modal-backdrop" (click)="cancelLogout()">
          <div class="modal-box" (click)="$event.stopPropagation()">
            <div class="modal-icon">🔒</div>
            <h3>¿Cerrar sesión?</h3>
            <p>Tu sesión se cerrará y tendrás que volver a iniciar sesión para acceder.</p>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="cancelLogout()">Cancelar</button>
              <button class="btn-confirm" (click)="doLogout()">Sí, cerrar sesión</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      --sidebar-width: 260px;
      --top-bar-height: 64px;
      --primary-color: var(--color-primary);
      --bg-color: var(--color-background);
      --text-main: var(--color-text);
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      display: block;
      height: 100vh;
    }

    .layout-container {
      display: flex;
      height: 100%;
      background-color: var(--bg-color);
    }

    .sidebar {
      width: var(--sidebar-width);
      background-color: var(--color-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .logo {
      padding: 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .logo h2 {
      margin: 0;
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .nav-menu {
      flex: 1;
      padding: 1.5rem 1rem;
      overflow-y: auto;
    }

    .nav-section { margin-bottom: 2rem; }

    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      margin-bottom: 0.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.05em;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: color 0.2s;
    }

    .section-title:hover { color: white; }

    .chevron {
      font-size: 0.6rem;
      transition: transform 0.3s ease;
    }

    .chevron.rotated { transform: rotate(-180deg); }

    .nav-links { list-style: none; padding: 0; margin: 0; }
    .nav-links li { margin-bottom: 0.25rem; }

    .nav-links a {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      color: #cbd5e1;
      text-decoration: none;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .nav-links a:hover {
      background-color: rgba(255,255,255,0.05);
      color: white;
    }

    .nav-links a.active {
      background-color: var(--color-primary);
      color: white;
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .top-bar {
      height: var(--top-bar-height);
      background-color: white;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      flex-shrink: 0;
    }

    .breadcrumb { color: var(--text-muted); font-size: 0.875rem; }

    .user-profile {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-user {
      border: 1.5px solid #d4dbe5;
      background: #fff;
      color: #1f2937;
      border-radius: 999px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
    }

    .btn-logout {
      background: none;
      border: 1.5px solid var(--color-primary);
      color: var(--color-primary);
      border-radius: 0.375rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
    }

    .btn-logout:hover {
      background-color: var(--color-primary);
      color: white;
    }

    .main-view {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    /* ── Modal logout ─────────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn .15s ease;
    }

    .modal-box {
      background: #fff;
      border-radius: 16px;
      padding: 32px 28px;
      max-width: 360px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      animation: slideUp .2s ease;
    }

    .modal-icon { font-size: 36px; margin-bottom: 12px; }

    .modal-box h3 {
      font-size: 18px;
      font-weight: 700;
      color: #1e1e1e;
      margin: 0 0 8px;
    }

    .modal-box p {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .btn-cancel {
      flex: 1;
      padding: 10px;
      border: 1.5px solid #e2e8f0;
      background: #fff;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: background .15s;
    }

    .btn-cancel:hover { background: #f9fafb; }

    .btn-confirm {
      flex: 1;
      padding: 10px;
      border: none;
      background: var(--color-primary);
      color: #fff;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s;
    }

    .btn-confirm:hover { opacity: .88; }

    @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  `]
})
export class LayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  protected readonly isUserPanelOpen  = signal(false);
  protected readonly showLogoutModal  = signal(false);

  protected readonly modules = signal([
    {
      name: 'Payment',
      expanded: false,
      features: [
        { name: 'Cash Receipt',   path: '/payment/cashreceipt' },
        { name: 'Facturas',       path: '/payment/invoice' },
        { name: 'Payment Method', path: '/payment/paymentmethod' }
      ]
    },
    {
      name: 'Commercial',
      expanded: false,
      features: [
        { name: 'Descuentos', path: '/commercial/discount' },
        { name: 'Descuentos por Cliente', path: '/commercial/customer-discount' },
        { name: 'Vendedores', path: '/commercial/seller' },
        { name: 'Compras',    path: '/commercial/purchases' },
        { name: 'Mesas',      path: '/commercial/tables' },
        { name: 'Ventas',     path: '/commercial/sales' }
      ]
    },
    {
      name: 'Inventory',
      expanded: true,
      features: [
        { name: 'Transfer',   path: '/inventory/transfer'   },
        { name: 'Categorías', path: '/inventory/categories' },
        { name: 'Productos',  path: '/inventory/product'    },
        { name: 'Recetas',    path: '/inventory/recipes'    },
        { name: 'Sedes',      path: '/inventor/locations' }
      ]
    }
  ]);

  toggleModule(moduleName: string): void {
    this.modules.update(mods => mods.map(m =>
      m.name === moduleName ? { ...m, expanded: !m.expanded } : m
    ));
  }

  openUserPanel():  void { this.isUserPanelOpen.set(true);  }
  closeUserPanel(): void { this.isUserPanelOpen.set(false); }

  // ── Logout con confirmación ───────────────────────────────────────────────

  confirmLogout(): void { this.showLogoutModal.set(true);  }
  cancelLogout():  void { this.showLogoutModal.set(false); }

  doLogout(): void {
    this.showLogoutModal.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}