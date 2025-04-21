import { Routes } from '@angular/router';
import { GuardianService } from './services/guardian/guardian.service'; // Desactivado temporalmente

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
    loadComponent: () => import('./home/home.page').then(m => m.HomePage)
    // canActivate: [GuardianService]
  },
  {
    path: 'historial',
    loadComponent: () => import('./historial/historial.page').then(m => m.HistorialPage)
    // canActivate: [GuardianService]
  },
  {
    path: 'resultado',
    loadComponent: () => import('./resultado/resultado.page').then(m => m.ResultadoPage)
  },
  {
    path: 'newquizz',
    loadComponent: () => import('./newquizz/newquizz.page').then( m => m.NewquizzPage)
  },
  {
    path: 'myquizz',
    loadComponent: () => import('./myquizz/myquizz.page').then( m => m.MyquizzPage)
  }

];
