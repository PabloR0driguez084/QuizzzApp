import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Quiz, QuizService } from '../services/QuizzService/quiz.service';
import { ModalController, ToastController, LoadingController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, addOutline, trashOutline } from 'ionicons/icons';

import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, 
  IonIcon, IonList, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner,
  // Añade estos componentes
  IonCard, IonCardHeader, IonCardContent, IonCardTitle
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-edit-quiz-modal',
  templateUrl: './edit-quiz-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, 
    IonIcon, IonList, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner,
    // También añádelos aquí
    IonCard, IonCardHeader, IonCardContent, IonCardTitle
  ]
})
export class EditQuizModalComponent implements OnInit {
  @Input() quizId!: string;
  quizForm!: FormGroup;
  isLoading = true;

  constructor(
    private fb: FormBuilder,
    private quizService: QuizService,
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    addIcons({ closeOutline, addOutline, trashOutline });
  }

  ngOnInit() {
    this.initForm();
    if (this.quizId) {
      this.loadQuizData();
    }
  }

  initForm() {
    this.quizForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      questions: this.fb.array([])
    });
  }

  get questions() {
    return this.quizForm.get('questions') as FormArray;
  }

  loadQuizData() {
    this.isLoading = true;
    this.quizService.getQuizById(this.quizId).subscribe({
      next: (quiz) => {
        // Crear formulario con los datos del quiz
        this.quizForm.patchValue({
          title: quiz.title,
          description: quiz.description
        });
        
        // Añadir preguntas al formArray
        quiz.questions.forEach(question => {
          const questionForm = this.fb.group({
            text: [question.text, Validators.required],
            options: this.fb.array([])
          });
          
          // Añadir opciones a cada pregunta
          const optionsArray = questionForm.get('options') as FormArray;
          question.options.forEach(option => {
            optionsArray.push(this.fb.control(option, Validators.required));
          });
          
          this.questions.push(questionForm);
        });
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el quiz:', error);
        this.isLoading = false;
        this.presentToast('Error al cargar el quiz: ' + error.message);
      }
    });
  }

  // Métodos para manejar el formulario (añadir/eliminar preguntas y opciones)
  addQuestion() {
    const newQuestion = this.fb.group({
      text: ['', Validators.required],
      options: this.fb.array([
        this.fb.control('', Validators.required)
      ])
    });
    
    this.questions.push(newQuestion);
  }

  removeQuestion(index: number) {
    this.questions.removeAt(index);
  }

  getOptionsFormArray(questionIndex: number): FormArray {
    return this.questions.at(questionIndex).get('options') as FormArray;
  }

  addOption(questionIndex: number) {
    const options = this.getOptionsFormArray(questionIndex);
    options.push(this.fb.control('', Validators.required));
  }

  removeOption(questionIndex: number, optionIndex: number) {
    const options = this.getOptionsFormArray(questionIndex);
    options.removeAt(optionIndex);
  }

  async saveQuiz() {
    if (this.quizForm.invalid) {
      this.presentToast('Por favor completa todos los campos requeridos');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Guardando quiz...'
    });
    await loading.present();

    const quizData = this.quizForm.value;
    
    this.quizService.updateQuiz(this.quizId, quizData).subscribe({
      next: () => {
        loading.dismiss();
        this.presentToast('Quiz actualizado correctamente');
        this.modalController.dismiss(true); // Para indicar que hubo cambios
      },
      error: (error) => {
        loading.dismiss();
        console.error('Error al actualizar el quiz:', error);
        this.presentToast('Error al guardar: ' + error.message);
      }
    });
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }

  cancel() {
    this.modalController.dismiss(false);
  }
}