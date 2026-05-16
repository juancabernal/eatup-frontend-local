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
        </section>

    @if (store.loading() && filteredSessions().length === 0) {
      <eatup-loading-skeleton [rows]="5" />
    } @else if (filteredSessions().length === 0) {
      <eatup-empty-state
        title="Sin sesiones"
        description="No hay sesiones para el filtro seleccionado."
      />
    } @else {

      <section class="timeline">

        @for (session of filteredSessions(); track session.id) {

          <article class="timeline-item">

            <div
              class="dot"
              [class.closed]="isClosed(session)"
            ></div>

            <div class="session-card">

              <div class="session-header">

                <div>
                  <span>Mesa {{ getTableNumber(session.tableId) }}</span>

                  <h2>
                    {{ session.guestCount }} invitados
                  </h2>

                  <p>
                    Abierta {{ session.openedAt | eatupDateTime }}
                  </p>

                  @if (session.closedAt) {
                    <p>
                      Cerrada {{ session.closedAt | eatupDateTime }}
                    </p>
                  }
                </div>

                <div class="session-meta">

                  <strong>
                    {{
                      session.durationText ??
                      ((session.durationMinutes ?? 0) + ' min')
                    }}
                  </strong>

                

                  <span
                    class="session-status"
                    [class.active]="!isClosed(session)"
                    [class.closed]="isClosed(session)"
                  >
                    {{ isClosed(session) ? 'Cerrada' : 'Activa' }}
                  </span>

                </div>

              </div>

              @if (session.observations) {
                <p class="note">
                  {{ session.observations }}
                </p>
              }

            </div>

          </article>

        }

      </section>
    }
  `,
  styleUrl: './tables-pages.css',
})
export class TablesSessionsPage implements OnInit {

  readonly store = inject(TablesStore);

  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  readonly filteredSessions = computed(() => {

    const sessions = this.store.sessions();
    const filter = this.statusFilter();

    if (filter === 'ACTIVE') {
      return sessions.filter(session => !session.closedAt);
    }

    if (filter === 'CLOSED') {
      return sessions.filter(session => !!session.closedAt);
    }

    return sessions;
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.store.loadSessions();
    this.store.loadTables();
  }

  isClosed(session: TableSessionDTO): boolean {
    return !!session.closedAt;
  }

  getTableNumber(tableId: string | undefined): string {

    if (!tableId) {
      return 'Sin asignar';
    }

    const table = this.store.tables().find(
      t => t.id === tableId
    );

    return table
      ? String(table.tableNumber)
      : tableId;
  }
}