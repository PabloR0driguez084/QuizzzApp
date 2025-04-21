import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  AlertController, 
  ToastController, 
  LoadingController, 
  ModalController 
} from '@ionic/angular/standalone';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonButton, 
  IonIcon, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonCardSubtitle,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonSearchbar,
  IonChip,
  IonFab,
  IonFabButton
} from '@ionic/angular/standalone';
import { QuizService, Quiz } from '../services/QuizzService/quiz.service';
import { Router } from '@angular/router';
import { Observable, finalize, tap } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  createOutline, 
  trashOutline, 
  eyeOutline, 
  refreshOutline, 
  addOutline, 
  searchOutline,
  arrowBackOutline,
  helpCircleOutline,
  timeOutline,
  personOutline,
  closeOutline
} from 'ionicons/icons';
import { DatePipe } from '@angular/common';
import { QuizDetailsModalComponent } from '../quiz-details-modal/quiz-details-modal.component';
import { EditQuizModalComponent } from '../edit-quiz-modal/edit-quiz-modal.component';

@Component({
  selector: 'app-myquizz',
  templateUrl: './myquizz.page.html',
  styleUrls: ['./myquizz.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonList, 
    IonItem, 
    IonLabel, 
    IonButton, 
    IonIcon, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent, 
    IonCardSubtitle,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonSearchbar,
    IonChip,
    IonFab,
    IonFabButton,
    DatePipe
  ]
})
export class MyquizzPage implements OnInit {
  quizzes: Quiz[] = [];
  filteredQuizzes: Quiz[] = [];
  isLoading: boolean = false;
  searchTerm: string = '';

  constructor(
    private quizService: QuizService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private modalController: ModalController
  ) {
    // Registrar iconos
    addIcons({
      createOutline, 
      trashOutline, 
      eyeOutline, 
      refreshOutline, 
      addOutline,
      searchOutline,
      arrowBackOutline,
      helpCircleOutline,
      timeOutline,
      personOutline,
      closeOutline
    });
  }

  ngOnInit() {
    this.loadQuizzes();
  }

  async loadQuizzes() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Cargando quizzes...',
      spinner: 'circular'
    });
    await loading.present();

    this.quizService.getMyQuizzes()
      .pipe(
        finalize(() => {
          loading.dismiss();
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (quizzes) => {
          this.quizzes = quizzes;
          this.filteredQuizzes = [...quizzes];
        },
        error: (error) => {
          console.error('Error al cargar los quizzes:', error);
          this.presentToast('Error al cargar los quizzes: ' + error.message);
        }
      });
  }

  // Búsqueda de quizzes
  filterQuizzes() {
    if (!this.searchTerm) {
      this.filteredQuizzes = [...this.quizzes];
      return;
    }

    const search = this.searchTerm.toLowerCase();
    this.filteredQuizzes = this.quizzes.filter(quiz => {
      return quiz.title.toLowerCase().includes(search) || 
             quiz.description.toLowerCase().includes(search);
    });
  }

  // Refrescar lista
  doRefresh(event: any) {
    this.quizService.getMyQuizzes().subscribe({
      next: (quizzes) => {
        this.quizzes = quizzes;
        this.filteredQuizzes = [...quizzes];
        event.target.complete();
      },
      error: (error) => {
        console.error('Error al refrescar los quizzes:', error);
        this.presentToast('Error al refrescar: ' + error.message);
        event.target.complete();
      }
    });
  }

  // Ver quiz (usando modal)
  async viewQuiz(quizId: string) {
    const modal = await this.modalController.create({
      component: QuizDetailsModalComponent,
      componentProps: {
        quizId: quizId
      }
    });
    return await modal.present();
  }

  // Editar quiz (usando modal)
  async editQuiz(quiz: Quiz) {
    const modal = await this.modalController.create({
      component: EditQuizModalComponent,
      componentProps: {
        quizId: quiz.id
      }
    });
    
    // Para refrescar la lista si hubo cambios
    modal.onDidDismiss().then((result) => {
      if (result.data === true) {
        this.loadQuizzes();
      }
    });
    
    return await modal.present();
  }

  // Eliminar quiz
  async confirmDelete(quiz: Quiz) {
    const alert = await this.alertController.create({
      header: '¿Estás seguro?',
      message: `¿Deseas eliminar el quiz "${quiz.title}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.deleteQuiz(quiz.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteQuiz(quizId: string) {
    const loading = await this.loadingController.create({
      message: 'Eliminando quiz...',
      spinner: 'circular'
    });
    await loading.present();

    this.quizService.deleteQuiz(quizId)
      .pipe(
        finalize(() => loading.dismiss())
      )
      .subscribe({
        next: () => {
          // Remover el quiz de las listas
          this.quizzes = this.quizzes.filter(q => q.id !== quizId);
          this.filteredQuizzes = this.filteredQuizzes.filter(q => q.id !== quizId);
          this.presentToast('Quiz eliminado correctamente');
        },
        error: (error) => {
          console.error('Error al eliminar el quiz:', error);
          this.presentToast('Error al eliminar: ' + error.message);
        }
      });
  }

  // Ir a crear nuevo quiz
  createNewQuiz() {
    this.router.navigate(['/newquizz']);
  }

  // Toast para mensajes
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }

  // Formatear fecha
  formatDate(date: any): string {
    if (!date) return 'Fecha desconocida';
    
    // Si es un objeto Timestamp de Firestore
    if (date && typeof date === 'object' && 'toDate' in date) {
      return date.toDate().toLocaleString();
    } 
    // Si ya es un objeto Date
    else if (date instanceof Date) {
      return date.toLocaleString();
    } 
    // Si es string o número, convertir a Date
    else {
      return new Date(date).toLocaleString();
    }
  }
}