import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quiz, QuizService } from '../services/QuizzService/quiz.service';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, 
  IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonItem,
  IonLabel, IonSpinner, IonList // Añade IonList aquí
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-quiz-details-modal',
  templateUrl: './quiz-details-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, 
    IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonItem, IonLabel,
    IonSpinner, IonList // Añade IonList también aquí
  ]
})
export class QuizDetailsModalComponent implements OnInit {
  @Input() quizId!: string;
  quiz?: Quiz;
  isLoading = true;

  constructor(
    private quizService: QuizService,
    private modalController: ModalController
  ) {
    addIcons({ closeOutline });
  }

  ngOnInit() {
    if (this.quizId) {
      this.loadQuizDetails();
    }
  }

  loadQuizDetails() {
    this.isLoading = true;
    this.quizService.getQuizById(this.quizId).subscribe({
      next: (quiz) => {
        this.quiz = quiz;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el quiz:', error);
        this.isLoading = false;
      }
    });
  }

  close() {
    this.modalController.dismiss();
  }
}