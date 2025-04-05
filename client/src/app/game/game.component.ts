import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, GameData, Question } from '../game.service';
import { LobbyService } from '../lobbys/lobby.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BuzzerComponent } from '../lobbys/buzzer/buzzer.component';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, HttpClientModule, BuzzerComponent],
  providers: [GameService],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit {
  @Input() lobbyCode: string = '';
  @Output() questionChanged = new EventEmitter<number>();

  gameData: GameData | null = null;
  currentQuestionIndex: number = 0;

  get currentQuestion(): Question | undefined {
    return this.gameData?.questions[this.currentQuestionIndex];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private lobbyService: LobbyService
  ) {}

  ngOnInit(): void {
    // If lobbyCode is not provided as input, try to get it from route params
    if (!this.lobbyCode) {
      this.route.params.subscribe((params) => {
        this.lobbyCode = params['lobbyCode'];
        this.loadGameData();
      });
    } else {
      this.loadGameData();
    }
  }

  loadGameData(): void {
    // Get the game data from the service
    this.gameData = this.gameService.getGameData();
    console.log('Game data in game component:', this.gameData);

    // If still no data, try loading it
    if (!this.gameData) {
      this.gameService.loadGameData().subscribe({
        next: (gameFile) => {
          this.gameData = gameFile.gameData;
          // Emit initial question index
          this.questionChanged.emit(this.currentQuestionIndex);
        },
        error: (err) => {
          console.error('Error loading game data:', err);
        },
      });
    } else {
      // Emit initial question index
      this.questionChanged.emit(this.currentQuestionIndex);
    }
  }

  nextQuestion(): void {
    if (
      this.gameData &&
      this.currentQuestionIndex < this.gameData.questions.length - 1
    ) {
      this.currentQuestionIndex++;
      this.questionChanged.emit(this.currentQuestionIndex);
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.questionChanged.emit(this.currentQuestionIndex);
    }
  }

  backToLobby(): void {
    this.router.navigate(['/lobby', this.lobbyCode]);
  }

  selectAnswer(option: string): void {
    console.log('Selected answer:', option);
    // Here you would handle the answer selection logic
    // For example, checking if it's correct and maybe moving to the next question
  }
  // Add to game.component.ts
  submitEstimation(value: string): void {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      console.log('Submitted estimation:', numericValue);
      // Here you would handle the estimation submission logic
      // For example, checking how close it is to the correct answer
    } else {
      console.error('Invalid estimation value');
      // Handle invalid input
    }
  }
}
