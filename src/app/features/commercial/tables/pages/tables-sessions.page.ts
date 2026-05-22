import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmptyStateComponent } from '../components/empty-state.component';
import { LoadingSkeletonComponent } from '../components/loading-skeleton.component';
import { DateTimePipe } from '../pipes/date-time.pipe';
import { TableSessionDTO } from '../models/table.models';
import { TablesStore } from '../store/tables.store';

@Component({
  selector: 'eatup-tables-sessions',
  standalone: true,
  imports: [FormsModule, LoadingSkeletonComponent, EmptyStateComponent, DateTimePipe],
  template: `
    <header class="page-header">
      <div>
        <span>Atención en mesa</span>
        <h1>Sesiones</h1>
        <p>Sesiones activas, cerradas, duración, meseros y observaciones operativas.</p>
      </div>
      <button type="button" (click)="reload()">Actualizar</button>
    </header>

    <section class="filters compact">
      <label class="status-filter">
        <span>Estado</span>
        <select [(ngModel)]="statusFilter">
          <option value="ALL">Todas</option>
          <option value="ACTIVE">Activas</option>
          <option value="CLOSED">Cerradas</option>
        </select>
      </label>
      <label class="status-filter">
        <span>Por página</span>
        <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set($event); goToPage(1)">
          <option [value]="5">5</option>
          <option [value]="10">10</option>
          <option [value]="20">20</option>
        </select>
      </label>
    </section>

    @if (store.loading() && filteredSessions().length === 0) {
      <eatup-loading-skeleton [rows]="5" />
    } @else if (filteredSessions().length === 0) {
      <eatup-empty-state title="Sin sesiones" description="No hay sesiones para el filtro seleccionado." />
    } @else {
      <section class="timeline">
        @for (session of paginatedSessions(); track session.id) {
          <article class="timeline-item">
            <div class="dot" [class.closed]="isClosed(session)"></div>
            <div class="session-card">
              <div class="session-header">
                <div>
                  <span>Mesa {{ getTableNumber(session.tableId) }}</span>
                  <h2>{{ session.guestCount }} invitados</h2>
                  <p>Abierta {{ session.openedAt | eatupDateTime }}</p>
                  @if (session.closedAt) {
                    <p>Cerrada {{ session.closedAt | eatupDateTime }}</p>
                  }
                </div>
                <div class="session-meta">
                  <strong>{{ session.durationText ?? ((session.durationMinutes ?? 0) + ' min') }}</strong>
                  <span class="session-status" [class.active]="!isClosed(session)" [class.closed]="isClosed(session)">
                    {{ isClosed(session) ? 'Cerrada' : 'Activa' }}
                  </span>
                </div>
              </div>
              @if (session.observations) {
                <p class="note">{{ session.observations }}</p>
              }
            </div>
          </article>
        }
      </section>

      <section class="pagination">
        <button type="button" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)">Anterior</button>
        @for (page of totalPages(); track page) {
          <button type="button" [class.active]="page === currentPage()" (click)="goToPage(page)">{{ page }}</button>
        }
        <button type="button" [disabled]="currentPage() === totalPages().length" (click)="goToPage(currentPage() + 1)">Siguiente</button>
        <span>{{ filteredSessions().length }} sesiones — Página {{ currentPage() }} de {{ totalPages().length }}</span>
      </section>
    }
  `,
  styleUrl: './tables-pages.css',
})
export class TablesSessionsPage implements OnInit {
  readonly store = inject(TablesStore);

  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  readonly currentPage = signal(1);
  readonly pageSize = signal(5);

  readonly filteredSessions = computed(() => {
    const sessions = this.store.sessions();
    const filter = this.statusFilter();

    if (filter === 'ACTIVE') return sessions.filter(s => !s.closedAt);
    if (filter === 'CLOSED') return sessions.filter(s => !!s.closedAt);
    return sessions;
  });

  readonly totalPages = computed(() => {
    const total = Math.ceil(this.filteredSessions().length / this.pageSize());
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  readonly paginatedSessions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredSessions().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.store.loadSessions();
    this.store.loadTables();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  isClosed(session: TableSessionDTO): boolean {
    return !!session.closedAt;
  }

  getTableNumber(tableId: string | undefined): string {
    if (!tableId) return 'Sin asignar';
    const table = this.store.tables().find(t => t.id === tableId);
    return table ? String(table.tableNumber) : tableId;
  }
}