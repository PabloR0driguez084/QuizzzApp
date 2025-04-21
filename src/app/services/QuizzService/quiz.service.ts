import { Injectable } from '@angular/core';
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
  DocumentReference
} from '@angular/fire/firestore';
import { AuthService } from '../auth.service';
import { Observable, from, map, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export interface QuizOption {
  text: string;
}

export interface QuizQuestion {
  text: string;
  options: string[];
}

export interface Quiz {
  id?: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  userDisplayName?: string;
  userEmail?: string;
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private readonly collectionName = 'quizzes';

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) { }

  // Crear un nuevo quiz
  createQuiz(quiz: Omit<Quiz, 'id' | 'createdBy' | 'createdAt' | 'userDisplayName' | 'userEmail'>): Observable<string> {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated) {
      return throwError(() => new Error('Debes iniciar sesión para crear un quiz'));
    }

    const currentUser = this.authService.currentUser;
    
    if (!currentUser) {
      return throwError(() => new Error('Usuario no encontrado'));
    }

    // Preparar el objeto quiz con los datos del usuario
    const newQuiz: Omit<Quiz, 'id'> = {
      ...quiz,
      createdBy: currentUser.uid,
      createdAt: new Date(),
      userDisplayName: currentUser.displayName || 'Usuario sin nombre',
      userEmail: currentUser.email || 'Sin email'
    };

    // Agregar el quiz a Firestore
    const quizCollection = collection(this.firestore, this.collectionName);
    
    return from(addDoc(quizCollection, newQuiz)).pipe(
      map(docRef => docRef.id),
      catchError(error => {
        console.error('Error al crear el quiz:', error);
        return throwError(() => new Error('Error al guardar el quiz: ' + error.message));
      })
    );
  }

  // Obtener quizzes del usuario actual
  getMyQuizzes(): Observable<Quiz[]> {
    if (!this.authService.isAuthenticated) {
      return of([]);
    }

    const currentUser = this.authService.currentUser;
    
    if (!currentUser) {
      return of([]);
    }

    const quizCollection = collection(this.firestore, this.collectionName);
    const userQuizzesQuery = query(quizCollection, where('createdBy', '==', currentUser.uid));
    
    return from(getDocs(userQuizzesQuery)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => {
          const data = doc.data() as Omit<Quiz, 'id'>;
          return { id: doc.id, ...data } as Quiz;
        });
      }),
      catchError(error => {
        console.error('Error al obtener los quizzes:', error);
        return throwError(() => new Error('Error al cargar los quizzes: ' + error.message));
      })
    );
  }

  // Obtener todos los quizzes
  getAllQuizzes(): Observable<Quiz[]> {
    const quizCollection = collection(this.firestore, this.collectionName);
    
    return from(getDocs(quizCollection)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => {
          const data = doc.data() as Omit<Quiz, 'id'>;
          return { id: doc.id, ...data } as Quiz;
        });
      }),
      catchError(error => {
        console.error('Error al obtener los quizzes:', error);
        return throwError(() => new Error('Error al cargar los quizzes: ' + error.message));
      })
    );
  }

  // Obtener un quiz por ID
  getQuizById(id: string): Observable<Quiz> {
    const quizDocRef = doc(this.firestore, this.collectionName, id);
    
    return from(getDoc(quizDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<Quiz, 'id'>;
          return { id: docSnap.id, ...data } as Quiz;
        } else {
          throw new Error('Quiz no encontrado');
        }
      }),
      catchError(error => {
        console.error('Error al obtener el quiz:', error);
        return throwError(() => new Error('Error al cargar el quiz: ' + error.message));
      })
    );
  }

  // Actualizar un quiz
updateQuiz(id: string, quizData: Partial<Quiz>): Observable<void> {
  if (!this.authService.isAuthenticated) {
    return throwError(() => new Error('Debes iniciar sesión para editar un quiz'));
  }

  const currentUser = this.authService.currentUser;
  
  if (!currentUser) {
    return throwError(() => new Error('Usuario no encontrado'));
  }

  // Primero verificamos que el quiz pertenezca al usuario actual
  return this.getQuizById(id).pipe(
    switchMap(quiz => {
      if (quiz.createdBy !== currentUser.uid) {
        throw new Error('No tienes permiso para editar este quiz');
      }
      
      // Actualizar el quiz
      const quizDocRef = doc(this.firestore, this.collectionName, id);
      const updatedData = {
        ...quizData,
        updatedAt: new Date()
      };
      
      // Convertimos la Promise en un Observable
      return from(updateDoc(quizDocRef, updatedData));
    }),
    catchError(error => {
      console.error('Error al actualizar el quiz:', error);
      return throwError(() => new Error('Error al actualizar el quiz: ' + error.message));
    })
  );
}

 // Eliminar un quiz
deleteQuiz(id: string): Observable<void> {
  if (!this.authService.isAuthenticated) {
    return throwError(() => new Error('Debes iniciar sesión para eliminar un quiz'));
  }

  const currentUser = this.authService.currentUser;
  
  if (!currentUser) {
    return throwError(() => new Error('Usuario no encontrado'));
  }

  // Primero verificamos que el quiz pertenezca al usuario actual
  return this.getQuizById(id).pipe(
    switchMap(quiz => {
      if (quiz.createdBy !== currentUser.uid) {
        throw new Error('No tienes permiso para eliminar este quiz');
      }
      
      // Eliminar el quiz
      const quizDocRef = doc(this.firestore, this.collectionName, id);
      return from(deleteDoc(quizDocRef));
    }),
    catchError(error => {
      console.error('Error al eliminar el quiz:', error);
      return throwError(() => new Error('Error al eliminar el quiz: ' + error.message));
    })
  );
}
}