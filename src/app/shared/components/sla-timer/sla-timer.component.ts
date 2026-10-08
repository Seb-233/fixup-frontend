import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { IonicModule } from '@ionic/angular/lazy';

type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  percentage: number;
  expired: boolean;
}

const URGENCY_SLA_HOURS: Record<UrgencyLevel, number> = {
  LOW: 168,
  MEDIUM: 72,
  HIGH: 24,
  URGENT: 4
};

@Component({
  selector: 'app-sla-timer',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="sla-timer" [class]="'sla-' + slaState()">
      <div class="sla-info">
        @if (!timeRemaining().expired) {
          <span class="sla-text">
            Quedan {{ timeRemaining().hours }}h {{ timeRemaining().minutes }}m
          </span>
        } @else {
          <span class="sla-text expired">Vencido</span>
        }
        <span class="sla-urgency" [class]="'urgency-' + urgencyLevel.toLowerCase()">
          {{ urgencyLabel() }}
        </span>
      </div>
      @if (showBadge()) {
        <ion-badge [color]="badgeColor()" class="sla-badge">
          {{ badgeLabel() }}
        </ion-badge>
      }
    </div>
  `,
  styleUrls: ['./sla-timer.component.scss']
})
export class SlaTimerComponent implements OnInit, OnDestroy {
  @Input() deadlineIso: string | null = null;
  @Input() urgencyLevel: UrgencyLevel = 'MEDIUM';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly timeRemaining = signal<TimeRemaining>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    percentage: 100,
    expired: false
  });

  readonly slaState = computed<'green' | 'amber' | 'red'>(() => {
    const tr = this.timeRemaining();
    if (tr.expired || tr.percentage < 20) {
      return 'red';
    }
    if (tr.percentage < 50) {
      return 'amber';
    }
    return 'green';
  });

  readonly showBadge = computed(() => {
    const state = this.slaState();
    return state === 'amber' || state === 'red';
  });

  readonly badgeColor = computed(() => {
    const state = this.slaState();
    if (state === 'red') {
      return 'danger';
    }
    return 'warning';
  });

  readonly badgeLabel = computed(() => {
    const state = this.slaState();
    if (state === 'red') {
      return 'SLA_BREACHED';
    }
    return 'SLA_WARNING';
  });

  readonly urgencyLabel = computed(() => {
    const labels: Record<UrgencyLevel, string> = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      URGENT: 'Urgente'
    };
    return labels[this.urgencyLevel];
  });

  ngOnInit(): void {
    this.calculateRemaining();
    this.intervalId = setInterval(() => this.calculateRemaining(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private calculateRemaining(): void {
    if (!this.deadlineIso) {
      const totalHours = URGENCY_SLA_HOURS[this.urgencyLevel];
      const totalMs = totalHours * 60 * 60 * 1000;
      this.timeRemaining.set({
        hours: totalHours,
        minutes: 0,
        seconds: 0,
        totalMs,
        percentage: 100,
        expired: false
      });
      return;
    }

    const deadline = new Date(this.deadlineIso).getTime();
    if (isNaN(deadline)) {
      return;
    }

    const now = Date.now();
    const totalHours = URGENCY_SLA_HOURS[this.urgencyLevel];
    const totalMs = totalHours * 60 * 60 * 1000;
    let remainingMs = deadline - now;
    const expired = remainingMs <= 0;

    if (expired) {
      remainingMs = 0;
    }

    const percentage = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.timeRemaining.set({
      hours,
      minutes,
      seconds,
      totalMs: remainingMs,
      percentage,
      expired
    });
  }
}
