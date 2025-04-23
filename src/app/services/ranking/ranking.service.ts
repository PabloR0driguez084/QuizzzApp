import { Injectable } from '@angular/core';
import { Observable, from, of, map, catchError, BehaviorSubject,switchMap } from 'rxjs';
import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  getDoc
} from '@angular/fire/firestore';
import { AuthService } from '../auth.service';
import { QuizService, Quiz } from '../QuizzService/quiz.service';
import { QuizAttempt } from '../quizinteractive/quiz-interactive.service';

export interface QuizRanking {
  quizId: string;
  quizTitle: string;
  topAttempts: QuizAttempt[];
  userBestAttempt?: QuizAttempt;
  userRank?: number;
}

export interface UserHistoryItem {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalPoints: number;
  maxPossiblePoints: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: Date;
  rank?: number;
}

@Injectable({
  providedIn: 'root'
})
export class RankingService {
  private readonly attemptsCollectionName = 'quiz-attempts';
  private readonly quizzesCollectionName = 'quizzes';
  
  // Cache de rankings para evitar consultas repetitivas
  private rankingsCache = new Map<string, QuizRanking>();
  
  // BehaviorSubject para el historial de usuario
  private userHistorySubject = new BehaviorSubject<UserHistoryItem[]>([]);
  public userHistory$ = this.userHistorySubject.asObservable();

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private quizService: QuizService
  ) {}

 // Obtener ranking de un quiz específico
getQuizRanking(quizId: string, limit: number = 10): Observable<QuizRanking> {
  // Verificar si ya tenemos el ranking en caché
  if (this.rankingsCache.has(quizId)) {
    return of(this.rankingsCache.get(quizId)!);
  }

  // Obtener los datos del quiz
  return from(getDoc(doc(this.firestore, this.quizzesCollectionName, quizId))).pipe(
    map(docSnap => {
      if (!docSnap.exists()) {
        throw new Error('Quiz no encontrado');
      }
      return { id: docSnap.id, ...docSnap.data() } as Quiz;
    }),
    map(quiz => {
      // Crear objeto de ranking con el título del quiz
      return {
        quizId: quiz.id || '',
        quizTitle: quiz.title,
        topAttempts: [] as QuizAttempt[],
        userBestAttempt: undefined,
        userRank: undefined
      } as QuizRanking;
    }),
    // Aquí está el cambio clave: usar switchMap en lugar de map
    switchMap(ranking => this.loadRankingData(ranking, limit)),
    catchError(error => {
      console.error('Error al obtener el ranking del quiz:', error);
      return of({
        quizId,
        quizTitle: 'Quiz desconocido',
        topAttempts: [],
      } as QuizRanking);
    })
  );
}

  // Cargar datos de ranking para un quiz
  private loadRankingData(ranking: QuizRanking, topLimit: number): Observable<QuizRanking> {
    const rankingQuery = query(
      collection(this.firestore, this.attemptsCollectionName),
      where('quizId', '==', ranking.quizId),
      orderBy('totalPoints', 'desc'),
      limit(topLimit)
    );

    return from(getDocs(rankingQuery)).pipe(
      map(snapshot => {
        // Obtener los mejores intentos
        ranking.topAttempts = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          // Convertir timestamp a Date si es necesario
          const completedAt = data.completedAt instanceof Date ? 
            data.completedAt : data.completedAt.toDate();
          
          return { 
            id: doc.id, 
            ...data,
            completedAt 
          } as QuizAttempt;
        });

        // Si el usuario está autenticado, buscar su mejor intento y rango
        const currentUserId = this.authService.currentUser?.uid;
        if (currentUserId) {
          this.findUserBestAttemptAndRank(ranking, currentUserId);
        }

        // Almacenar en caché
        this.rankingsCache.set(ranking.quizId, ranking);
        return ranking;
      }),
      catchError(error => {
        console.error('Error al cargar datos del ranking:', error);
        return of(ranking);
      })
    );
  }

  // Buscar el mejor intento del usuario y su rango en el ranking
  private findUserBestAttemptAndRank(ranking: QuizRanking, userId: string): void {
    // Verificar si el usuario ya está en el top
    const userInTop = ranking.topAttempts.find(attempt => attempt.userId === userId);
    if (userInTop) {
      ranking.userBestAttempt = userInTop;
      ranking.userRank = ranking.topAttempts.findIndex(attempt => attempt.userId === userId) + 1;
      return;
    }

    // Si no está en el top, buscar su mejor intento
    const userAttemptsQuery = query(
      collection(this.firestore, this.attemptsCollectionName),
      where('quizId', '==', ranking.quizId),
      where('userId', '==', userId),
      orderBy('totalPoints', 'desc'),
      limit(1)
    );

    // Ejecutar la consulta
    getDocs(userAttemptsQuery).then(snapshot => {
      if (!snapshot.empty) {
        const bestAttempt = snapshot.docs[0];
        const data = bestAttempt.data() as any;
        const completedAt = data.completedAt instanceof Date ? 
          data.completedAt : data.completedAt.toDate();
        
        ranking.userBestAttempt = { 
          id: bestAttempt.id, 
          ...data,
          completedAt 
        } as QuizAttempt;

        // Determinar el rango del usuario
        this.determineUserRank(ranking);
      }
    }).catch(error => {
      console.error('Error al buscar el mejor intento del usuario:', error);
    });
  }

  // Determinar el rango del usuario en el ranking general
  private determineUserRank(ranking: QuizRanking): void {
    if (!ranking.userBestAttempt) return;

    // Consulta para contar cuántos intentos tienen más puntos que el mejor del usuario
    const betterAttemptsQuery = query(
      collection(this.firestore, this.attemptsCollectionName),
      where('quizId', '==', ranking.quizId),
      where('totalPoints', '>', ranking.userBestAttempt.totalPoints)
    );

    getDocs(betterAttemptsQuery).then(snapshot => {
      // El rango es el número de intentos mejores + 1
      ranking.userRank = snapshot.size + 1;
    }).catch(error => {
      console.error('Error al determinar el rango del usuario:', error);
    });
  }


  // Obtener todos los rankings de quizzes
getAllQuizRankings(limit: number = 10): Observable<QuizRanking[]> {
  // Obtener todos los quizzes - Aquí está el cambio:
  return this.quizService.getAllQuizzes().pipe(
    map(quizzes => {
      // Para cada quiz, obtener su ranking
      const observables = quizzes.map(quiz => 
        this.getQuizRanking(quiz.id || '', limit)
      );
      
      // Retornar un array vacío si no hay quizzes
      if (observables.length === 0) {
        return [];
      }
      
      // Combinar todos los observables en uno solo
      return observables;
    }),
    map(observables => {
      // Obtener los rankings de forma asíncrona
      observables.forEach(observable => {
        observable.subscribe();
      });
      
      // Devolver los rankings actuales de la caché
      return Array.from(this.rankingsCache.values());
    })
  );
}

  // Obtener el historial de intentos del usuario actual
  getUserQuizHistory(): Observable<UserHistoryItem[]> {
    if (!this.authService.isAuthenticated) {
      this.userHistorySubject.next([]);
      return of([]);
    }

    const currentUserId = this.authService.currentUser?.uid;
    if (!currentUserId) {
      this.userHistorySubject.next([]);
      return of([]);
    }

    const userAttemptsQuery = query(
      collection(this.firestore, this.attemptsCollectionName),
      where('userId', '==', currentUserId),
      orderBy('completedAt', 'desc')
    );

    return from(getDocs(userAttemptsQuery)).pipe(
      map(snapshot => {
        const attempts = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          const completedAt = data.completedAt instanceof Date ? 
            data.completedAt : data.completedAt.toDate();
          
          return { 
            id: doc.id, 
            ...data,
            completedAt 
          } as QuizAttempt;
        });

        // Agrupar por quizId para obtener información de cada quiz
        const quizIds = [...new Set(attempts.map(attempt => attempt.quizId))];
        
        // Crear un mapa de promesas para obtener los títulos de los quizzes
        const quizTitlePromises = quizIds.map(quizId => 
          getDoc(doc(this.firestore, this.quizzesCollectionName, quizId))
            .then(docSnap => ({ 
              quizId, 
              title: docSnap.exists() ? (docSnap.data() as Quiz).title : 'Quiz desconocido' 
            }))
        );

        // Resolver todas las promesas de títulos
        Promise.all(quizTitlePromises).then(quizTitles => {
          const quizTitleMap = new Map(quizTitles.map(item => [item.quizId, item.title]));
          
          // Crear el historial de usuario
          const historyItems: UserHistoryItem[] = attempts.map(attempt => ({
            id: attempt.id || '',
            quizId: attempt.quizId,
            quizTitle: quizTitleMap.get(attempt.quizId) || 'Quiz desconocido',
            score: attempt.score,
            totalPoints: attempt.totalPoints,
            maxPossiblePoints: attempt.maxPossiblePoints,
            correctAnswers: attempt.correctAnswers,
            totalQuestions: attempt.totalQuestions,
            completedAt: attempt.completedAt
          }));

          // Actualizar el BehaviorSubject
          this.userHistorySubject.next(historyItems);
        });

        return [];
      }),
      catchError(error => {
        console.error('Error al obtener el historial del usuario:', error);
        this.userHistorySubject.next([]);
        return of([]);
      })
    );
  }

  // Limpiar caché de rankings
  clearCache(): void {
    this.rankingsCache.clear();
  }
}