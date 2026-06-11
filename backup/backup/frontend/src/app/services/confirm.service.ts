import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title:       string;
  message:     string;
  confirmText: string;
  cancelText:  string;
  danger:      boolean;   // red confirm button for destructive actions
}

// Global confirmation dialog — replaces the native window.confirm().
// Usage:  if (!(await this.confirm.ask('Delete this?', { danger: true }))) return;
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((ok: boolean) => void) | null = null;

  ask(message: string, opts: Partial<Omit<ConfirmRequest, 'message'>> = {}): Promise<boolean> {
    // resolve any dialog already open (treat as cancelled) before opening a new one
    if (this.resolver) this.respond(false);
    this.request.set({
      message,
      title:       opts.title       ?? 'Please confirm',
      confirmText: opts.confirmText ?? 'Confirm',
      cancelText:  opts.cancelText  ?? 'Cancel',
      danger:      opts.danger      ?? false,
    });
    return new Promise<boolean>((resolve) => { this.resolver = resolve; });
  }

  respond(ok: boolean): void {
    this.request.set(null);
    const r = this.resolver;
    this.resolver = null;
    r?.(ok);
  }
}
