import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withHashLocation } from '@angular/router';

import { AppComponent } from './app/app';
import { routes } from './app/app.routes';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
    ...appConfig.providers   // ✅ spread appConfig providers — no duplicate HttpClient
  ]
}).catch(err => console.error(err));