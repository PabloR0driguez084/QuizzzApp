import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButton, 
  IonItem, 
  IonLabel, 
  IonInput,
  IonCheckbox,
  IonIcon,
  ToastController,
  AlertController,
  LoadingController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonCheckbox,
    IonIcon,
    CommonModule, 
    FormsModule,
    ReactiveFormsModule
  ]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  registerForm!: FormGroup;
  isSignUp: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private authService: AuthService
  ) {
    addIcons({ logoGoogle });
  }

  ngOnInit() {
    this.initForms();
  }

  initForms() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registerForm = this.formBuilder.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      terms: [false, [Validators.requiredTrue]]
    });
  }

  signIn() {
    this.isSignUp = false;
  }

  signUp() {
    this.isSignUp = true;
  }

  async login() {
    if (this.loginForm.valid) {
      const loading = await this.showLoading('Iniciando sesión...');
      try {
        const { email, password } = this.loginForm.value;
        await this.authService.loginWithEmail(email, password);
        
        await loading.dismiss();
        this.showSuccessToast('Inicio de sesión exitoso');
      } catch (error: any) {
        await loading.dismiss();
        this.showErrorToast(this.getAuthErrorMessage(error.code));
      }
    }
  }

  async register() {
    if (this.registerForm.valid) {
      const loading = await this.showLoading('Creando cuenta...');
      try {
        const { email, password, fullName } = this.registerForm.value;
        await this.authService.registerWithEmail(email, password, fullName);
        
        await loading.dismiss();
        this.showSuccessToast('Registro exitoso! Bienvenido');
        this.router.navigate(['/profile']);
      } catch (error: any) {
        await loading.dismiss();
        this.showErrorToast(this.getAuthErrorMessage(error.code));
      }
    }
  }

  async loginWithGoogle() {
    const loading = await this.showLoading('Iniciando sesión con Google...');
    try {
      await this.authService.loginWithGoogle();
      
      await loading.dismiss();
      this.showSuccessToast('Inicio de sesión con Google exitoso');
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error en login con Google:', error);
      this.showErrorToast(this.getAuthErrorMessage(error.code));
    }
  }

  async registerWithGoogle() {
    // En realidad, el proceso es el mismo que loginWithGoogle
    // Firebase automáticamente creará una cuenta si no existe
    await this.loginWithGoogle();
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Recuperar Contraseña',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Ingresa tu correo electrónico'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (data.email) {
              const loading = await this.showLoading('Enviando correo de recuperación...');
              try {
                await this.authService.resetPassword(data.email);
                loading.dismiss();
                this.showSuccessToast('Se ha enviado un correo de recuperación');
              } catch (error: any) {
                loading.dismiss();
                this.showErrorToast(this.getAuthErrorMessage(error.code));
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showLoading(message: string) {
    const loading = await this.loadingController.create({
      message,
      spinner: 'circular'
    });
    await loading.present();
    return loading;
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color: 'success'
    });
    await toast.present();
  }

  private async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger'
    });
    await toast.present();
  }

  private getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada.';
      case 'auth/user-not-found':
        return 'No existe una cuenta con este correo electrónico.';
      case 'auth/wrong-password':
        return 'Contraseña incorrecta.';
      case 'auth/email-already-in-use':
        return 'Este correo electrónico ya está en uso.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/popup-closed-by-user':
        return 'Se cerró la ventana de autenticación antes de completar el proceso.';
      case 'auth/cancelled-popup-request':
        return 'La operación fue cancelada debido a múltiples solicitudes.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para este sitio.';
      case 'auth/operation-not-allowed':
        return 'Esta operación no está permitida. Contacta al administrador.';
      case 'auth/network-request-failed':
        return 'Error de red. Verifica tu conexión a internet.';
      default:
        return 'Ocurrió un error durante la autenticación. Inténtalo de nuevo.';
    }
  }
}