import { Routes } from '@angular/router';
import { GuardianService } from './services/guardian/guardian.service';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
    canActivate: [GuardianService] // Protege esta ruta para usuarios autenticados
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.routes').then(m => m.routes),
    canActivate: [GuardianService] // Protege esta ruta para usuarios autenticados
  },
  {
    path: 'historial',
    loadComponent: () => import('./historial/historial.page').then(m => m.HistorialPage),
    canActivate: [GuardianService] // Protege esta ruta para usuarios autenticados
  },
  {
    path: 'resultado',
    loadComponent: () => import('./resultado/resultado.page').then(m => m.ResultadoPage),
    canActivate: [GuardianService] // Protege esta ruta para usuarios autenticados
  },
  {
    path: 'newquizz',
    loadComponent: () => import('./newquizz/newquizz.page').then(m => m.NewquizzPage),
    canActivate: [GuardianService],
    data: { requiredRole: 'admin' } // Solo administradores pueden crear quizzes
  },
  {
    path: 'myquizz',
    loadComponent: () => import('./myquizz/myquizz.page').then(m => m.MyquizzPage),
    canActivate: [GuardianService],
    data: { requiredRole: 'admin' } // Solo administradores pueden ver sus quizzes
  }
];