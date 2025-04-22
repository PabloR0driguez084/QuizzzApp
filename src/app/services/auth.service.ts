import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  User,
  UserCredential,
  sendPasswordResetEmail,
  getRedirectResult,
  updateProfile
} from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';

// Custom error types for more specific error handling
export class AuthenticationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Interface to define credentials structure
interface Credentials {
  email: string;
  password: string;
}

// Interface to define user data from Firestore
interface UserData {
  role: string;
  email: string;
  fullName: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  // Variable for temporary credentials storage
  private tempCredentials: Credentials | null = null;

  constructor(
    private auth: Auth,
    private router: Router,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {
    this.auth.onAuthStateChanged((user) => {
      console.log('Auth State Changed:', user);
      this.currentUserSubject.next(user);
    });
  }

  storeTemporaryCredentials(email: string, password: string): void {
    this.tempCredentials = { email, password };
  }

  getTemporaryCredentials(): Credentials | null {
    return this.tempCredentials;
  }

  clearTemporaryCredentials(): void {
    this.tempCredentials = null;
  }

  private handleAuthError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    let errorCode = 'auth/unknown-error';

    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format';
        errorCode = 'auth/invalid-email';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This user account has been disabled';
        errorCode = 'auth/user-disabled';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No user found with this email';
        errorCode = 'auth/user-not-found';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password';
        errorCode = 'auth/wrong-password';
        break;
      case 'auth/email-already-in-use':
        errorMessage = 'Email is already registered';
        errorCode = 'auth/email-already-in-use';
        break;
      case 'auth/popup-closed-by-user':
        errorMessage = 'Login popup was closed';
        errorCode = 'auth/popup-closed-by-user';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Operation not allowed';
        errorCode = 'auth/operation-not-allowed';
        break;
      default:
        errorMessage = error.message || 'Authentication failed';
        errorCode = error.code || 'auth/unknown-error';
    }

    console.error('Authentication Error:', errorCode, errorMessage);

    return throwError(() => new AuthenticationError(errorCode, errorMessage));
  }

  async loginWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('Email Login Successful:', userCredential.user);

      const userData = await this.getCurrentUserData();
      if (userData?.role) {
        console.log('User Role:', userData.role);
      }

      this.router.navigate(['/home']);
      return userCredential;
    } catch (error: any) {
      console.error('Email Login Error:', error);
      throw this.handleAuthError(error).toPromise();
    }
  }

  async registerWithEmail(
    email: string,
    password: string,
    displayName?: string,
    role: string = 'student'
  ): Promise<UserCredential> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);

      await this.firestore.collection('users').doc(userCredential.user.uid).set({
        fullName: displayName || email,
        email: email,
        role: role,
      });

      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }

      console.log('Email Registration Successful:', userCredential.user);
      this.router.navigate(['/home']);
      return userCredential;
    } catch (error: any) {
      console.error('Email Registration Error:', error);
      throw this.handleAuthError(error).toPromise();
    }
  }

  async loginWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();

    try {
      const userCredential = await signInWithPopup(this.auth, provider);
      console.log('Google Login (Popup) Successful:', userCredential.user);
      this.router.navigate(['/home']);
      return userCredential;
    } catch (error: any) {
      console.error('Google Login Popup Error:', error);

      if (error.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(this.auth, provider);
          console.log('Redirecting to Google Login');
          return Promise.reject(error);
        } catch (redirectError) {
          console.error('Google Redirect Error:', redirectError);
          throw this.handleAuthError(redirectError).toPromise();
        }
      }
      throw this.handleAuthError(error).toPromise();
    }
  }

  async handleGoogleRedirectResult(): Promise<UserCredential | null> {
    try {
      const result = await getRedirectResult(this.auth);
      if (result) {
        console.log('Google Redirect Result:', result);

        if (result.user) {
          console.log('Google Redirect Authentication Successful:', result.user);
          this.router.navigate(['/home']);
          return result;
        } else {
          console.warn('Redirect result found, but no user object');
          return null;
        }
      } else {
        console.warn('No redirect result found');
        return null;
      }
    } catch (error: any) {
      console.error('Google Redirect Error:', error);
      throw this.handleAuthError(error).toPromise();
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      console.log('Password reset email sent successfully');
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      throw this.handleAuthError(error).toPromise();
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('Logout Successful');
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error('Logout Error:', error);
      throw error;
    }
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  get isAuthenticated(): boolean {
    return !!this.auth.currentUser;
  }

  // 🔧 CORREGIDO: Tipado seguro
  async getCurrentUserData(): Promise<UserData | null> {
    const user = await this.afAuth.currentUser;
    if (!user) return null;
    const doc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
    return doc?.data() as UserData;
  }

  async getUserRole(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    if (!user) return null;

    const doc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
    return (doc?.data() as UserData)?.role || null;
  }
}
