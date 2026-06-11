import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';

// Global confirmation dialog outlet — mounted once in AppComponent.
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-overlay" *ngIf="confirm.request() as req" (click)="confirm.respond(false)">
      <div class="confirm-box" (click)="$event.stopPropagation()">
        <h3 class="confirm-title">{{ req.title }}</h3>
        <p class="confirm-message">{{ req.message }}</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn cancel" (click)="confirm.respond(false)">
            {{ req.cancelText }}
          </button>
          <button type="button" class="confirm-btn ok" [class.danger]="req.danger"
                  (click)="confirm.respond(true)">
            {{ req.confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center;
      animation: confirm-fade .15s ease-out;
    }
    .confirm-box {
      background: #fff; border-radius: 12px; width: 92%; max-width: 420px;
      padding: 22px 22px 18px; box-shadow: 0 18px 50px rgba(0,0,0,.3);
      font-family: sans-serif; animation: confirm-pop .16s ease-out;
    }
    .confirm-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #111827; }
    .confirm-message { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #374151; white-space: pre-line; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .confirm-btn {
      border: none; border-radius: 8px; padding: 9px 18px; font-size: 14px;
      font-weight: 600; cursor: pointer;
    }
    .confirm-btn.cancel { background: #e5e7eb; color: #111827; }
    .confirm-btn.cancel:hover { background: #d1d5db; }
    .confirm-btn.ok { background: #2563eb; color: #fff; }
    .confirm-btn.ok:hover { background: #1d4ed8; }
    .confirm-btn.ok.danger { background: #dc2626; }
    .confirm-btn.ok.danger:hover { background: #b91c1c; }
    @keyframes confirm-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes confirm-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
  `]
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);
}
