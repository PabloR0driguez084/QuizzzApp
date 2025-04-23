import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RankingService, UserHistoryItem, QuizRanking } from '../services/ranking/ranking.service';
import { addIcons } from 'ionicons';
import { AuthService } from '../services/auth.service'; 
import { 
  timeOutline, 
  trophyOutline, 
  ribbonOutline, 
  documentTextOutline,
  barChartOutline,
  listOutline,
  personOutline,
  chevronForwardOutline,
  alertCircleOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
})
export class HistorialPage implements OnInit, OnDestroy {
  historial: UserHistoryItem[] = [];
  quizRankings: QuizRanking[] = [];
  selectedSegment: 'historial' | 'rankings' = 'historial';
  isLoading: boolean = true;
  errorMessage: string | null = null;
  
  private subscriptions: Subscription = new Subscription();

  constructor(private rankingService: RankingService, public authService: AuthService) {
    // Registrar íconos
    addIcons({
      'time-outline': timeOutline,
      'trophy-outline': trophyOutline,
      'ribbon-outline': ribbonOutline,
      'document-text-outline': documentTextOutline,
      'bar-chart-outline': barChartOutline,
      'list-outline': listOutline,
      'person-outline': personOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'alert-circle-outline': alertCircleOutline
    });
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadData() {
    this.isLoading = true;
    this.errorMessage = null;
    
    // Cargar historial de usuario
    this.subscriptions.add(
      this.rankingService.userHistory$.subscribe(
        (historyItems) => {
          this.historial = historyItems;
          this.isLoading = false;
        }
      )
    );
    
    // Iniciar la carga de historial
    this.rankingService.getUserQuizHistory().subscribe({
      error: (err) => {
        this.errorMessage = `Error al cargar el historial: ${err.message}`;
        this.isLoading = false;
      }
    });
    
    // Cargar rankings de todos los quizzes
    this.subscriptions.add(
      this.rankingService.getAllQuizRankings().subscribe(
        (rankings) => {
          this.quizRankings = rankings;
        },
        (error) => {
          console.error('Error al cargar rankings:', error);
          this.errorMessage = `Error al cargar rankings: ${error.message}`;
        }
      )
    );
  }

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
  }

  getRankColor(rank: number): string {
    if (rank === 1) return 'warning'; // Oro
    if (rank === 2) return 'secondary'; // Plata
    if (rank === 3) return 'tertiary'; // Bronce
    return 'medium'; // Resto
  }

  formatDate(date: Date): string {
    if (!date) return '';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Menos de 24 horas: "Hoy a las HH:MM"
    if (diff < 24 * 60 * 60 * 1000 && now.getDate() === date.getDate()) {
      return `Hoy a las ${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}`;
    }
    
    // Menos de 48 horas: "Ayer a las HH:MM"
    if (diff < 48 * 60 * 60 * 1000 && now.getDate() - 1 === date.getDate()) {
      return `Ayer a las ${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}`;
    }
    
    // Formato completo: "DD/MM/YYYY a las HH:MM"
    return `${this.padZero(date.getDate())}/${this.padZero(date.getMonth() + 1)}/${date.getFullYear()} ${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}`;
  }
  
  private padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  refreshData(event: any) {
    // Limpiar caché y recargar datos
    this.rankingService.clearCache();
    this.loadData();
    
    // Completar el evento de refresh
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}