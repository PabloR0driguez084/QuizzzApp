import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, map, tap, of, catchError } from 'rxjs';
import { QuizService, Quiz, QuizQuestion } from '../QuizzService/quiz.service';
import { 
  Firestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  getDoc,
  orderBy,
  limit
} from '@angular/fire/firestore';
import { AuthService } from '../auth.service';


export interface QuizAttempt {
  id?: string;
  quizId: string;
  userId: string;
  userName: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  totalPoints: number; // Nuevo campo para almacenar puntos totales
  maxPossiblePoints: number; // Nuevo campo para puntos máximos posibles
  completedAt: Date;
  answers: {
    questionIndex: number;
    selectedOption: string;
    isCorrect: boolean;
    pointsEarned: number; // Puntos ganados en esta pregunta
    timeRemaining: number; // Tiempo restante cuando se respondió
  }[];
}

export interface CurrentQuizState {
  quiz: Quiz | null;
  currentQuestionIndex: number;
  selectedAnswers: { [questionIndex: number]: string };
  answerTimes: { [questionIndex: number]: number }; // Nuevo campo para guardar tiempo restante al responder
  completed: boolean;
  score: number;
  correctAnswers: number;
  totalPoints: number; // Puntos totales acumulados
  maxPossiblePoints: number; // Puntos máximos posibles
  isLoading: boolean;
  error: string | null;
  // Campos para el temporizador
  timeRemaining: number;
  timerRunning: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QuizInteractiveService {
  private readonly attemptsCollectionName = 'quiz-attempts';
  
  // Propiedades para el temporizador
  private timerInterval: any;
  private readonly questionTimeLimit = 30; // 30 segundos por pregunta
  
  // BehaviorSubject para seguir el estado actual del quiz
  private currentQuizStateSubject = new BehaviorSubject<CurrentQuizState>({
    quiz: null,
    currentQuestionIndex: 0,
    selectedAnswers: {},
    answerTimes: {}, // Inicializamos el nuevo campo
    completed: false,
    score: 0,
    correctAnswers: 0,
    totalPoints: 0, // Inicializamos el nuevo campo
    maxPossiblePoints: 0, // Inicializamos el nuevo campo
    isLoading: false,
    error: null,
    timeRemaining: this.questionTimeLimit,
    timerRunning: false
  });

  // Observable para exponer el estado actual del quiz
  public currentQuizState$ = this.currentQuizStateSubject.asObservable();

  constructor(
    private quizService: QuizService,
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  // Cargar quiz por código único
  loadQuizByCode(code: string): Observable<Quiz | null> {
    // Actualizar estado de carga
    this.updateState({ isLoading: true, error: null });

    return this.quizService.getQuizByCode(code).pipe(
      tap(quiz => {
        if (quiz) {
          // Si hay preguntas en el quiz, seleccionar aleatoriamente 10 o todas si son menos de 10
          let selectedQuestions = quiz.questions;
          if (selectedQuestions.length > 10) {
            // Seleccionar aleatoriamente 10 preguntas
            selectedQuestions = this.getRandomQuestions(quiz.questions, 10);
          }

          // Actualizar quiz con preguntas seleccionadas
          const limitedQuiz = {
            ...quiz,
            questions: selectedQuestions
          };

          // Calcular puntos máximos posibles (questionTimeLimit por cada pregunta)
          const maxPossiblePoints = selectedQuestions.length * this.questionTimeLimit;

          // Actualizar el estado con el quiz
          this.updateState({
            quiz: limitedQuiz,
            isLoading: false,
            currentQuestionIndex: 0,
            selectedAnswers: {},
            answerTimes: {}, // Reiniciar tiempos de respuesta
            completed: false,
            score: 0,
            correctAnswers: 0,
            totalPoints: 0,
            maxPossiblePoints: maxPossiblePoints,
            timeRemaining: this.questionTimeLimit,
            timerRunning: false
          });
          
          // Iniciar el temporizador
          this.startTimer();
        } else {
          this.updateState({ 
            isLoading: false, 
            error: 'Quiz no encontrado con este código' 
          });
        }
      }),
      catchError(error => {
        this.updateState({ 
          isLoading: false, 
          error: `Error al cargar el quiz: ${error.message}`
        });
        return of(null);
      })
    );
  }

  // Obtener preguntas aleatorias de un array
  private getRandomQuestions(questions: QuizQuestion[], count: number): QuizQuestion[] {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Actualizar el estado actual del quiz
  private updateState(newState: Partial<CurrentQuizState>): void {
    const currentState = this.currentQuizStateSubject.value;
    this.currentQuizStateSubject.next({
      ...currentState,
      ...newState
    });
  }

  // Iniciar el temporizador
  startTimer(): void {
    // Limpiar cualquier intervalo existente
    this.clearTimer();
    
    // Establecer el tiempo inicial
    this.updateState({ 
      timeRemaining: this.questionTimeLimit,
      timerRunning: true 
    });
    
    // Iniciar un nuevo intervalo
    this.timerInterval = setInterval(() => {
      const currentState = this.currentQuizStateSubject.value;
      
      if (currentState.timeRemaining > 0) {
        // Decrementar el tiempo restante
        this.updateState({ timeRemaining: currentState.timeRemaining - 1 });
      } else {
        // Si el tiempo se acabó, avanzar a la siguiente pregunta o finalizar el quiz
        this.clearTimer();
        
        // Guardar la respuesta actual como vacía si no se ha seleccionado
        // y registrar que el tiempo se acabó (0 segundos restantes)
        if (!currentState.selectedAnswers[currentState.currentQuestionIndex]) {
          this.selectAnswer(currentState.currentQuestionIndex, "", 0);
        }
        
        if (currentState.currentQuestionIndex < (currentState.quiz?.questions.length || 0) - 1) {
          // Si no es la última pregunta, avanzar a la siguiente
          this.nextQuestion();
        } else {
          // Si es la última pregunta, completar el quiz
          this.completeQuiz().subscribe();
        }
      }
    }, 1000);
  }

  // Detener el temporizador
  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateState({ timerRunning: false });
  }

  // Manejar la selección de respuesta con tiempo restante
  selectAnswer(questionIndex: number, answerText: string, timeOverride?: number): void {
    const currentState = this.currentQuizStateSubject.value;
    const timeRemaining = timeOverride !== undefined ? timeOverride : currentState.timeRemaining;
    
    const newSelectedAnswers = {
      ...currentState.selectedAnswers,
      [questionIndex]: answerText
    };
    
    const newAnswerTimes = {
      ...currentState.answerTimes,
      [questionIndex]: timeRemaining
    };

    this.updateState({ 
      selectedAnswers: newSelectedAnswers,
      answerTimes: newAnswerTimes
    });
  }

  // Avanzar a la siguiente pregunta
  nextQuestion(): void {
    const currentState = this.currentQuizStateSubject.value;
    if (currentState.currentQuestionIndex < (currentState.quiz?.questions.length || 0) - 1) {
      this.updateState({ 
        currentQuestionIndex: currentState.currentQuestionIndex + 1,
        timeRemaining: this.questionTimeLimit
      });
      
      // Reiniciar el temporizador para la nueva pregunta
      this.startTimer();
    }
  }

  // Retroceder a la pregunta anterior
  previousQuestion(): void {
    const currentState = this.currentQuizStateSubject.value;
    if (currentState.currentQuestionIndex > 0) {
      this.updateState({ 
        currentQuestionIndex: currentState.currentQuestionIndex - 1,
        timeRemaining: this.questionTimeLimit
      });
      
      // Reiniciar el temporizador para la nueva pregunta
      this.startTimer();
    }
  }

  // Ir a una pregunta específica
  goToQuestion(index: number): void {
    const currentState = this.currentQuizStateSubject.value;
    if (index >= 0 && index < (currentState.quiz?.questions.length || 0)) {
      this.updateState({ 
        currentQuestionIndex: index,
        timeRemaining: this.questionTimeLimit
      });
      
      // Reiniciar el temporizador para la nueva pregunta
      this.startTimer();
    }
  }

  // Pausar el temporizador (opcional)
  pauseTimer(): void {
    this.clearTimer();
  }

  // Reanudar el temporizador (opcional)
  resumeTimer(): void {
    if (!this.timerInterval) {
      this.startTimer();
    }
  }

  // Completar el quiz y calcular puntuación
  completeQuiz(): Observable<QuizAttempt | null> {
    // Detener el temporizador cuando se completa el quiz
    this.clearTimer();
    
    const currentState = this.currentQuizStateSubject.value;
    
    if (!currentState.quiz || !this.authService.isAuthenticated) {
      this.updateState({ 
        error: 'Debes iniciar sesión para completar el quiz' 
      });
      return of(null);
    }

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      this.updateState({ 
        error: 'Usuario no encontrado' 
      });
      return of(null);
    }

    // Calcular puntuación
    const totalQuestions = currentState.quiz.questions.length;
    let correctAnswers = 0;
    let totalPoints = 0;
    
    // Consideramos la primera opción como la correcta por ahora
    // (En una app real, tendrías una respuesta correcta designada)
    const answers = currentState.quiz.questions.map((question, index) => {
      const selectedOption = currentState.selectedAnswers[index] || '';
      const timeRemaining = currentState.answerTimes[index] || 0;
      
      // Para este ejemplo, consideremos la primera opción como la respuesta correcta
      const isCorrect = selectedOption === question.options[0];
      
      // Calcular puntos según las reglas:
      // - 0 puntos si es incorrecta o el tiempo llegó a 0
      // - [segundos restantes] puntos si es correcta y el tiempo > 0
      let pointsEarned = 0;
      if (isCorrect && timeRemaining > 0) {
        pointsEarned = timeRemaining;
        correctAnswers++;
        totalPoints += pointsEarned;
      }
      
      return {
        questionIndex: index,
        selectedOption,
        isCorrect,
        pointsEarned,
        timeRemaining
      };
    });

    // Calcular porcentaje de puntos conseguidos sobre el máximo posible
    const maxPossiblePoints = totalQuestions * this.questionTimeLimit;
    const score = maxPossiblePoints > 0 ? (totalPoints / maxPossiblePoints) * 100 : 0;

    // Crear registro de intento de quiz
    const attempt: Omit<QuizAttempt, 'id'> = {
      quizId: currentState.quiz.id || '',
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Usuario anónimo',
      score,
      totalQuestions,
      correctAnswers,
      totalPoints,
      maxPossiblePoints,
      completedAt: new Date(),
      answers
    };

    // Actualizar estado local con resultados
    this.updateState({
      completed: true,
      score,
      correctAnswers,
      totalPoints,
      maxPossiblePoints
    });

    // Guardar intento en Firestore
    const attemptCollection = collection(this.firestore, this.attemptsCollectionName);
    return from(addDoc(attemptCollection, attempt)).pipe(
      map(docRef => ({ id: docRef.id, ...attempt } as QuizAttempt)),
      catchError(error => {
        this.updateState({ 
          error: `Error al guardar los resultados: ${error.message}` 
        });
        return of(null);
      })
    );
  }

  // Resetear el estado del quiz
  resetQuiz(): void {
    // Detener el temporizador
    this.clearTimer();
    
    this.updateState({
      quiz: null,
      currentQuestionIndex: 0,
      selectedAnswers: {},
      answerTimes: {},
      completed: false,
      score: 0,
      correctAnswers: 0,
      totalPoints: 0,
      maxPossiblePoints: 0,
      isLoading: false,
      error: null,
      timeRemaining: this.questionTimeLimit,
      timerRunning: false
    });
  }

  // Obtener ranking para un quiz específico
  getQuizRanking(quizId: string): Observable<QuizAttempt[]> {
    const attemptCollection = collection(this.firestore, this.attemptsCollectionName);
    const rankingQuery = query(
      attemptCollection, 
      where('quizId', '==', quizId),
      orderBy('totalPoints', 'desc'), // Ordenar por puntos totales en lugar de score
      limit(20)
    );

    return from(getDocs(rankingQuery)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => {
          const data = doc.data() as Omit<QuizAttempt, 'id'>;
          return { id: doc.id, ...data } as QuizAttempt;
        });
      }),
      catchError(error => {
        console.error('Error al obtener el ranking:', error);
        return of([]);
      })
    );
  }

  // Obtener intentos del usuario para un quiz específico
  getUserQuizAttempts(quizId: string): Observable<QuizAttempt[]> {
    if (!this.authService.isAuthenticated) {
      return of([]);
    }

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }

    const attemptCollection = collection(this.firestore, this.attemptsCollectionName);
    const userAttemptsQuery = query(
      attemptCollection, 
      where('quizId', '==', quizId),
      where('userId', '==', currentUser.uid),
      orderBy('completedAt', 'desc')
    );

    return from(getDocs(userAttemptsQuery)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => {
          const data = doc.data() as Omit<QuizAttempt, 'id'>;
          return { id: doc.id, ...data } as QuizAttempt;
        });
      }),
      catchError(error => {
        console.error('Error al obtener los intentos del usuario:', error);
        return of([]);
      })
    );
  }
}