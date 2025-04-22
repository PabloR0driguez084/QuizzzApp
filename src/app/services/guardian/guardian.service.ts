import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../auth.service';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class GuardianService implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    // Verificar autenticación inmediatamente
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/login']);
      return false;
    }
    
    // Si no se requiere rol específico, permitir acceso
    const requiredRole = route.data['requiredRole'] as string;
    if (!requiredRole) {
      return true;
    }
    
    // Convertir la promesa a observable para mejor manejo de errores
    return of(this.authService.getUserRole()).pipe(
      switchMap(rolePromise => from(rolePromise)),
      map(userRole => {
        if (userRole === requiredRole) {
          return true;
        } else {
          this.router.navigate(['/home']);
          return false;
        }
      }),
      catchError(error => {
        console.error('Error al verificar el rol:', error);
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}