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
  correctOption: string;
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
  codeNumber?: string; // Nuevo campo para el código numérico
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

  // Generar un código numérico aleatorio
  private generateRandomCode(length: number): string {
    let result = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    // Asegurarse de que el primer dígito no sea cero
    if (result.charAt(0) === '0') {
      result = characters.charAt(Math.floor(Math.random() * (charactersLength - 1)) + 1) + result.substring(1);
    }
    return result;
  }

  // Verificar si un código ya existe
  private async isCodeUnique(code: string): Promise<boolean> {
    const quizCollection = collection(this.firestore, this.collectionName);
    const codeQuery = query(quizCollection, where('codeNumber', '==', code));
    const snapshot = await getDocs(codeQuery);
    return snapshot.empty;
  }

  // Generar un código único
  private async generateUniqueCode(): Promise<string> {
    // Determinar una longitud aleatoria entre 4 y 10 dígitos
    const codeLength = Math.floor(Math.random() * 7) + 4; // Entre 4 y 10
    
    let code = this.generateRandomCode(codeLength);
    let isUnique = await this.isCodeUnique(code);
    
    // Si el código ya existe, seguir intentando hasta encontrar uno único
    let attempts = 0;
    const maxAttempts = 10; // Limitar el número de intentos para evitar bucles infinitos
    
    while (!isUnique && attempts < maxAttempts) {
      code = this.generateRandomCode(codeLength);
      isUnique = await this.isCodeUnique(code);
      attempts++;
    }
    
    if (!isUnique) {
      // Si después de varios intentos no encontramos un código único,
      // aumentamos la longitud para tener más combinaciones posibles
      return this.generateUniqueCode();
    }
    
    return code;
  }

  // Crear un nuevo quiz
  createQuiz(quiz: Omit<Quiz, 'id' | 'createdBy' | 'createdAt' | 'userDisplayName' | 'userEmail' | 'codeNumber'>): Observable<string> {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated) {
      return throwError(() => new Error('Debes iniciar sesión para crear un quiz'));
    }

    const currentUser = this.authService.currentUser;
    
    if (!currentUser) {
      return throwError(() => new Error('Usuario no encontrado'));
    }

    // Primero generamos un código único
    return from(this.generateUniqueCode()).pipe(
      switchMap(codeNumber => {
        // Preparar el objeto quiz con los datos del usuario y el código único
        const newQuiz: Omit<Quiz, 'id'> = {
          ...quiz,
          createdBy: currentUser.uid,
          createdAt: new Date(),
          userDisplayName: currentUser.displayName || 'Usuario sin nombre',
          userEmail: currentUser.email || 'Sin email',
          codeNumber: codeNumber
        };

        // Agregar el quiz a Firestore
        const quizCollection = collection(this.firestore, this.collectionName);
        
        return from(addDoc(quizCollection, newQuiz)).pipe(
          map(docRef => docRef.id)
        );
      }),
      catchError(error => {
        console.error('Error al crear el quiz:', error);
        return throwError(() => new Error('Error al guardar el quiz: ' + error.message));
      })
    );
  }

  // Obtener un quiz por su código numérico
  getQuizByCode(code: string): Observable<Quiz | null> {
    const quizCollection = collection(this.firestore, this.collectionName);
    const codeQuery = query(quizCollection, where('codeNumber', '==', code));
    
    return from(getDocs(codeQuery)).pipe(
      map(snapshot => {
        if (snapshot.empty) {
          return null;
        }
        const doc = snapshot.docs[0];
        const data = doc.data() as Omit<Quiz, 'id'>;
        return { id: doc.id, ...data } as Quiz;
      }),
      catchError(error => {
        console.error('Error al buscar quiz por código:', error);
        return throwError(() => new Error('Error al buscar el quiz: ' + error.message));
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
  // Añade esta función en tu clase QuizService

// Barajar opciones de preguntas aleatoriamente
randomizeQuizOptions(quiz: Quiz): Quiz {
  // Creamos una copia profunda del quiz
  const randomizedQuiz = JSON.parse(JSON.stringify(quiz)) as Quiz;
  
  // Para cada pregunta
  randomizedQuiz.questions.forEach(question => {
    // Asegúrate de que correctOption esté definido
    if (!question.correctOption && question.options.length > 0) {
      question.correctOption = question.options[0]; // Por defecto la primera si no está definida
    }
    
    // Guarda la respuesta correcta
    const correctAnswer = question.correctOption;
    
    // Barajar las opciones
    const shuffledOptions = [...question.options].sort(() => 0.5 - Math.random());
    
    // Actualizar las opciones y la respuesta correcta
    question.options = shuffledOptions;
    question.correctOption = correctAnswer;
  });
  
  return randomizedQuiz;
}
}