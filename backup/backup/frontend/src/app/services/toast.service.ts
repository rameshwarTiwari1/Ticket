import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Lightweight global toast/notification service — replaces browser alert().
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  private push(type: Toast['type'], message: string, ms: number): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(message: string, ms = 4000): void { this.push('success', message, ms); }
  error(message: string,   ms = 6000): void { this.push('error',   message, ms); }
  info(message: string,    ms = 4000): void { this.push('info',    message, ms); }
  warning(message: string, ms = 5000): void { this.push('warning', message, ms); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
