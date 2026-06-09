import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

// Global toast outlet — mounted once in AppComponent.
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let t of toast.toasts()" class="toast" [class]="'toast toast-' + t.type"
           (click)="toast.dismiss(t.id)">
        <i class="toast-icon fa-solid"
           [ngClass]="{
             'fa-circle-check': t.type === 'success',
             'fa-circle-xmark': t.type === 'error',
             'fa-triangle-exclamation': t.type === 'warning',
             'fa-circle-info': t.type === 'info'
           }"></i>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" (click)="toast.dismiss(t.id); $event.stopPropagation()">&times;</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; top: 20px; right: 20px; z-index: 99999;
      display: flex; flex-direction: column; gap: 10px; max-width: 380px;
    }
    .toast {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 10px; color: #fff; cursor: pointer;
      box-shadow: 0 6px 20px rgba(0,0,0,.18); font-size: 14px; font-family: sans-serif;
      animation: toast-in .18s ease-out;
    }
    .toast-success { background: #16a34a; }
    .toast-error   { background: #dc2626; }
    .toast-warning { background: #d97706; }
    .toast-info    { background: #2563eb; }
    .toast-icon { font-size: 16px; flex: 0 0 auto; }
    .toast-msg  { flex: 1 1 auto; line-height: 1.35; }
    .toast-close { background: none; border: none; color: #fff; font-size: 18px; line-height: 1; cursor: pointer; opacity: .85; }
    @keyframes toast-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }
  `]
})
export class ToastComponent {
  toast = inject(ToastService);
}
