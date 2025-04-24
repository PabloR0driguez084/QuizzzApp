import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, ToastController, LoadingController } from '@ionic/angular/standalone';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonItem, 
  IonInput, 
  IonTextarea, 
  IonList, 
  IonListHeader, 
  IonButton, 
  IonIcon,
  IonButtons,
  IonLoading
} from '@ionic/angular/standalone';
import * as XLSX from 'xlsx';
import { Papa } from 'ngx-papaparse';
import { QuizService } from '../services/QuizzService/quiz.service';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

// Definir la nueva interfaz QuizQuestion
export interface QuizQuestion {
  text: string;
  options: string[];
  correctOption: string; // Añadir esta propiedad para indicar la respuesta correcta
}

@Component({
  selector: 'app-newquizz',
  templateUrl: './newquizz.page.html',
  styleUrls: ['./newquizz.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonSegment, 
    IonSegmentButton, 
    IonLabel, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent, 
    IonItem, 
    IonInput, 
    IonTextarea, 
    IonList, 
    IonListHeader, 
    IonButton, 
    IonIcon,
    IonButtons,
    IonLoading,
    CommonModule, 
    FormsModule
  ]
})
export class NewquizzPage implements OnInit {
  selectedMode: 'manual' | 'file' = 'manual';
  selectedFile: File | null = null;
  quizTitle: string = '';
  quizDescription: string = '';
  questions: QuizQuestion[] = [];
  currentQuestion: QuizQuestion = {
    text: '',
    options: ['', ''], // Inicialmente dos opciones vacías
    correctOption: '' // Inicialmente vacía
  };
  isLoading: boolean = false;

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private papa: Papa,
    private quizService: QuizService,
    private router: Router
  ) { }

  ngOnInit() {
    // Inicialización básica
  }

  resetForm() {
    this.quizTitle = '';
    this.quizDescription = '';
    this.questions = [];
    this.currentQuestion = {
      text: '',
      options: ['', ''],
      correctOption: ''
    };
    this.selectedFile = null;
  }

  // Métodos para manejar los cambios en los inputs
  updateQuestionText(event: any) {
    this.currentQuestion.text = event.detail.value;
  }

  updateOptionText(index: number, event: any) {
    this.currentQuestion.options[index] = event.detail.value;
    
    // Si es la primera opción, actualizar también la respuesta correcta
    if (index === 0) {
      this.currentQuestion.correctOption = event.detail.value;
    }
  }

  // Métodos para el modo manual
  addOption() {
    this.currentQuestion.options.push('');
  }

  removeOption(index: number) {
    if (this.currentQuestion.options.length > 2) {
      // Si se elimina la primera opción, actualizar la respuesta correcta a la nueva primera opción
      if (index === 0 && this.currentQuestion.options.length > 1) {
        this.currentQuestion.correctOption = this.currentQuestion.options[1];
      }
      this.currentQuestion.options.splice(index, 1);
    }
  }

  async addQuestion() {
    if (!this.currentQuestion.text) {
      this.presentToast('Debes ingresar el texto de la pregunta');
      return;
    }

    if (this.currentQuestion.options.some(option => !option)) {
      this.presentToast('Todas las opciones deben tener texto');
      return;
    }
    
    // Asegurar que la respuesta correcta sea la primera opción
    this.currentQuestion.correctOption = this.currentQuestion.options[0];

    // Hacer una copia profunda para evitar referencias
    const questionCopy: QuizQuestion = {
      text: this.currentQuestion.text,
      options: [...this.currentQuestion.options],
      correctOption: this.currentQuestion.correctOption
    };
    
    this.questions.push(questionCopy);
    
    // Reiniciar el formulario de pregunta actual
    this.currentQuestion = {
      text: '',
      options: ['', ''],
      correctOption: ''
    };
    
    this.presentToast('Pregunta agregada correctamente');
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  // Métodos para el modo de carga de archivo
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  processFile() {
    if (!this.selectedFile) {
      this.presentToast('No se ha seleccionado ningún archivo');
      return;
    }

    const fileReader = new FileReader();
    
    fileReader.onload = (e) => {
      const arrayBuffer = fileReader.result;
      
      if (this.selectedFile!.name.endsWith('.csv')) {
        this.processCSV(fileReader.result as string);
      } else {
        this.processExcel(arrayBuffer as ArrayBuffer);
      }
    };

    if (this.selectedFile.name.endsWith('.csv')) {
      fileReader.readAsText(this.selectedFile);
    } else {
      fileReader.readAsArrayBuffer(this.selectedFile);
    }
  }

  processExcel(data: ArrayBuffer) {
    try {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      this.processSheetData(jsonData as any[][]);
    } catch (error) {
      this.presentToast('Error al procesar el archivo Excel');
      console.error(error);
    }
  }

  processCSV(data: string) {
    this.papa.parse(data, {
      complete: (result) => {
        this.processSheetData(result.data as any[][]);
      },
      error: (error) => {
        this.presentToast('Error al procesar el archivo CSV');
        console.error(error);
      }
    });
  }

  processSheetData(data: any[][]) {
    if (data.length < 2) {
      this.presentToast('El archivo no contiene suficientes datos');
      return;
    }

    const questions: QuizQuestion[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Verificar que la fila tenga al menos una pregunta y dos opciones
      if (row.length >= 3) {
        const question: QuizQuestion = {
          text: row[0],
          options: [],
          correctOption: row[1] // La primera opción (columna 1) es la respuesta correcta
        };
        
        // La primera columna es la pregunta, las demás son opciones
        for (let j = 1; j < row.length; j++) {
          if (row[j]) { // Asegurarse de que la opción no esté vacía
            question.options.push(row[j]);
          }
        }
        
        // Solo agregar preguntas con al menos dos opciones
        if (question.options.length >= 2) {
          questions.push(question);
        }
      }
    }

    if (questions.length === 0) {
      this.presentToast('No se encontraron preguntas válidas en el archivo');
      return;
    }

    this.questions = questions;
    this.presentToast(`Se cargaron ${questions.length} preguntas`);
  }

  // Método para guardar el quiz en Firebase
  async saveQuiz() {
    if (!this.quizTitle) {
      this.presentToast('El quiz debe tener un título');
      return;
    }

    if (this.questions.length === 0) {
      this.presentToast('El quiz debe tener al menos una pregunta');
      return;
    }

    // Mostrar indicador de carga
    const loading = await this.loadingController.create({
      message: 'Guardando quiz...',
    });
    await loading.present();
    this.isLoading = true;

    // Crear el objeto del quiz
    const quiz = {
      title: this.quizTitle,
      description: this.quizDescription,
      questions: this.questions
    };

    // Guardar en Firebase usando el servicio
    this.quizService.createQuiz(quiz)
      .pipe(
        finalize(() => {
          loading.dismiss();
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (quizId) => {
          console.log('Quiz guardado con ID:', quizId);
          this.presentToast('Quiz guardado correctamente');
          this.resetForm();
          // Redirigir a la página de mis quizzes
          this.router.navigate(['/myquizz']);
        },
        error: (error) => {
          console.error('Error al guardar el quiz:', error);
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
}