import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { QuizService, Quiz, QuizQuestion } from '../services/QuizzService/quiz.service';
import { QuizInteractiveService, QuizAttempt } from '../services/quizinteractive/quiz-interactive.service';
import { addIcons } from 'ionicons';
import { 
  searchOutline, 
  playOutline, 
  closeOutline, 
  arrowBackOutline,
  arrowForward,
  checkmarkOutline,
  checkmarkCircle,
  closeCircle,
  timeOutline,
  trophyOutline // Añadido para puntuación
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonicModule, 
    RouterModule, 
    CommonModule, 
    FormsModule
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  // Código de quiz
  quizCode: string = '';
  errorMessage: string | null = null;
  
  // Estado del modal de quiz
  isModalOpen: boolean = false;
  
  // Estado del quiz activo
  quiz: Quiz | null = null;
  quizTitle: string = 'Quiz Interactivo';
  currentQuestionIndex: number = 0;
  totalQuestions: number = 0;
  selectedAnswers: { [key: number]: string } = {};
  isLoading: boolean = false;
  completed: boolean = false;
  score: number = 0;
  correctAnswers: number = 0;
  totalPoints: number = 0; // Nuevo campo para puntos totales
  maxPossiblePoints: number = 0; // Nuevo campo para puntos máximos posibles
  questionsArray: number[] = [];
  quizRanking: QuizAttempt[] = [];
  answersReview: Array<{
    question: string;
    selectedOption: string;
    correctOption: string;
    isCorrect: boolean;
    pointsEarned: number; // Nuevo campo para puntos obtenidos
    timeRemaining: number; // Nuevo campo para tiempo restante
  }> = [];

  // Propiedades para el temporizador
  timeRemaining: number = 30;
  timerRunning: boolean = false;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private quizService: QuizService,
    private quizInteractiveService: QuizInteractiveService
  ) {
    // Registrar íconos
    addIcons({
      'search-outline': searchOutline,
      'play-outline': playOutline,
      'close-outline': closeOutline,
      'arrow-back-outline': arrowBackOutline,
      'arrow-forward': arrowForward,
      'checkmark-outline': checkmarkOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'time-outline': timeOutline,
      'trophy-outline': trophyOutline // Nuevo ícono para puntuación
    });
  }

  ngOnInit() {
    this.subscriptions.add(
      this.quizInteractiveService.currentQuizState$.subscribe(state => {
        this.quiz = state.quiz;
        this.currentQuestionIndex = state.currentQuestionIndex;
        this.selectedAnswers = state.selectedAnswers;
        this.completed = state.completed;
        this.score = state.score;
        this.correctAnswers = state.correctAnswers;
        this.totalPoints = state.totalPoints; // Actualizamos puntos totales
        this.maxPossiblePoints = state.maxPossiblePoints; // Actualizamos puntos máximos
        this.isLoading = state.isLoading;
        this.errorMessage = state.error;
        
        // Actualizar propiedades del temporizador
        this.timeRemaining = state.timeRemaining;
        this.timerRunning = state.timerRunning;
        
        if (this.quiz) {
          this.quizTitle = this.quiz.title;
          this.totalQuestions = this.quiz.questions.length;
          this.questionsArray = Array(this.totalQuestions).fill(0).map((_, i) => i);
          
          // Si el quiz está completado, preparar la revisión de respuestas
          if (this.completed) {
            this.prepareAnswersReview();
            this.loadQuizRanking();
          }
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Método para formatear el tiempo restante (MM:SS)
  formatTimeRemaining(): string {
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Método para obtener el color del temporizador basado en el tiempo restante
  getTimerColor(): string {
    if (this.timeRemaining > 20) return 'success';
    if (this.timeRemaining > 10) return 'warning';
    return 'danger';
  }

  loadQuizByCode() {
    if (!this.quizCode) {
      this.errorMessage = 'Por favor ingresa un código de quiz';
      return;
    }

    this.errorMessage = null;
    
    // Cargar quiz por código
    this.subscriptions.add(
      this.quizInteractiveService.loadQuizByCode(this.quizCode).subscribe(quiz => {
        if (quiz) {
          // Abrir el modal (activar la vista del quiz)
          this.isModalOpen = true;
        }
      })
    );
  }

  // Métodos para el quiz interactivo
  get currentQuestion() {
    return this.quiz?.questions[this.currentQuestionIndex];
  }

  onAnswerSelected(event: any) {
    console.log('Evento de selección:', event);
    const selectedOption = event.detail.value;
    
    if (selectedOption) {
      console.log('Opción seleccionada:', selectedOption);
      console.log('Pregunta actual:', this.currentQuestionIndex);
      console.log('Tiempo restante:', this.timeRemaining);
      
      // Actualiza el estado local directamente
      this.selectedAnswers = {
        ...this.selectedAnswers,
        [this.currentQuestionIndex]: selectedOption
      };
      
      // Luego notifica al servicio con el tiempo restante actual
      this.quizInteractiveService.selectAnswer(this.currentQuestionIndex, selectedOption, this.timeRemaining);
    }
  }

  nextQuestion() {
    this.quizInteractiveService.nextQuestion();
  }

  previousQuestion() {
    this.quizInteractiveService.previousQuestion();
  }

  goToQuestion(index: number) {
    this.quizInteractiveService.goToQuestion(index);
  }

  finishQuiz() {
    this.subscriptions.add(
      this.quizInteractiveService.completeQuiz().subscribe(attempt => {
        if (attempt) {
          console.log('Quiz completado:', attempt);
        }
      })
    );
  }

  allQuestionsAnswered(): boolean {
    if (!this.quiz) return false;
    return Object.keys(this.selectedAnswers).length === this.totalQuestions;
  }

  prepareAnswersReview() {
    if (!this.quiz) return;
    
    this.answersReview = this.quiz.questions.map((question, index) => {
      const selectedOption = this.selectedAnswers[index] || '';
      // Para este ejemplo, considerando la primera opción como la correcta
      const correctOption = question.options[0];
      const isCorrect = selectedOption === correctOption;
      
      // En lugar de obtener tiempos del servicio, necesitaremos almacenarlos en el componente
      // Usaremos datos simulados si no tenemos esta información
      let timeRemaining = 0;
      
      if (this.completed) {
        // Si tenemos acceso a los datos del quiz completado, podemos usar esa información
        const quizAttempt = this.quizRanking.find(a => a.userId === 'currentUserId'); // Reemplazar con el ID real del usuario
        if (quizAttempt && quizAttempt.answers && quizAttempt.answers[index]) {
          timeRemaining = quizAttempt.answers[index].timeRemaining;
        }
      }
      
      // Calcular puntos según las reglas del nuevo sistema
      let pointsEarned = 0;
      if (isCorrect && timeRemaining > 0) {
        pointsEarned = timeRemaining;
      }
      
      return {
        question: question.text,
        selectedOption,
        correctOption,
        isCorrect,
        pointsEarned,
        timeRemaining
      };
    });
  }

  loadQuizRanking() {
    if (!this.quiz || !this.quiz.id) return;
    
    this.subscriptions.add(
      this.quizInteractiveService.getQuizRanking(this.quiz.id).subscribe(ranking => {
        this.quizRanking = ranking;
      })
    );
  }

  getScoreColor(): string {
    if (this.score >= 80) return '#4caf50'; // Verde para puntuaciones altas
    if (this.score >= 60) return '#ff9800'; // Naranja para puntuaciones medias
    return '#f44336'; // Rojo para puntuaciones bajas
  }

  closeQuiz() {
    this.isModalOpen = false;
    this.quizInteractiveService.resetQuiz();
    this.quizCode = '';
  }
  
  onRadioClick(option: string) {
    console.log('Radio clicked:', option);
    console.log('Current question:', this.currentQuestionIndex);
    console.log('Tiempo restante:', this.timeRemaining);
    
    // Update local state
    this.selectedAnswers = {
      ...this.selectedAnswers,
      [this.currentQuestionIndex]: option
    };
    
    // Update service with current time remaining
    this.quizInteractiveService.selectAnswer(this.currentQuestionIndex, option, this.timeRemaining);
  }
  
  onSelectAnswer(option: string) {
    console.log('Selected option:', option);
    console.log('Tiempo restante:', this.timeRemaining);
    
    // Update local state
    this.selectedAnswers = {
      ...this.selectedAnswers,
      [this.currentQuestionIndex]: option
    };
    
    // Update service with current time remaining
    this.quizInteractiveService.selectAnswer(this.currentQuestionIndex, option, this.timeRemaining);
  }
}