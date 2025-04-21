// app.component.ts
import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonListHeader, IonNote, IonMenuToggle, IonItem, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { homeOutline, homeSharp, timeOutline, timeSharp, clipboardOutline, clipboardSharp, chevronForwardOutline, chevronForwardSharp } from 'ionicons/icons';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    RouterLinkActive, 
    IonApp, 
    IonSplitPane, 
    IonMenu, 
    IonContent, 
    IonList, 
    IonListHeader, 
    IonNote, 
    IonMenuToggle, 
    IonItem, 
    IonIcon, 
    IonLabel, 
    IonRouterOutlet
  ],
})
export class AppComponent {
  @ViewChildren('menuItem') menuItems!: QueryList<ElementRef>;
  
  public appPages = [
    { title: 'Home', url: '/home', icon: 'home' },
    { title: 'Historial', url: '/historial', icon: 'time' },
    { title: 'New Quizz', url: '/newquizz', icon: 'clipboard' },
    { title: 'My Quizz', url: '/myquizz', icon: 'clipboard' }
  ];
  
  public isLoginPage = false;
  
  constructor(
    private router: Router
  ) {
    addIcons({
      homeOutline, homeSharp,
      timeOutline, timeSharp,
      clipboardOutline, clipboardSharp,
      chevronForwardOutline, chevronForwardSharp
    });
    
    // Detectar si estamos en la página de login
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isLoginPage = event.url === '/login';
    });
  }

  onMenuOpen() {
    setTimeout(() => {
      if (this.menuItems && this.menuItems.first) {
        const firstMenuItem = this.menuItems.first.nativeElement;
        firstMenuItem.focus();
      }
    }, 150);
  }

  onMenuClose() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      const focusableElement = mainContent.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusableElement) {
        (focusableElement as HTMLElement).focus();
      }
    }
  }
}