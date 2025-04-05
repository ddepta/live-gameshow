import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, GameData, Question } from '../game.service';
import { LobbyService } from '../lobbys/lobby.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BuzzerComponent } from '../lobbys/buzzer/buzzer.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, HttpClientModule, BuzzerComponent],
  providers: [GameService],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() lobbyCode: string = '';
  @Input() isModerator: boolean = false;
  @Output() questionChanged = new EventEmitter<number>();

  private subscriptions: Subscription[] = [];
  private previousQuestionIndex = 0;

  gameData: GameData | null = null;
  currentQuestionIndex: number = 0;

  // Animation states
  isAnimating = false;
  isAnimatingOut = false;
  isAnimatingIn = false;
  animationDirection: 'next' | 'prev' = 'next';

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

    // Listen for question change events from service
    this.subscriptions.push(
      this.lobbyService.onQuestionChanged().subscribe((questionIndex) => {
        // Only non-moderators should respond to these events
        if (!this.isModerator) {
          console.log('Updating to question:', questionIndex);

          // Determine animation direction based on the index change
          this.animationDirection =
            questionIndex > this.currentQuestionIndex ? 'next' : 'prev';

          // Store current index before changing it
          const oldIndex = this.currentQuestionIndex;

          // Animate the question change
          this.animateQuestionChange(() => {
            this.currentQuestionIndex = questionIndex;
            // Emit the change back up to the lobby component
            this.questionChanged.emit(this.currentQuestionIndex);
          });
        }
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
      this.currentQuestionIndex < this.gameData.questions.length - 1 &&
      !this.isAnimating
    ) {
      this.animationDirection = 'next';
      this.animateQuestionChange(() => {
        this.currentQuestionIndex++;
        this.questionChanged.emit(this.currentQuestionIndex);

        // Only moderator should broadcast question changes
        if (this.isModerator) {
          this.lobbyService.changeQuestion(
            this.lobbyCode,
            this.currentQuestionIndex
          );
        }
      });
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0 && !this.isAnimating) {
      this.animationDirection = 'prev';
      this.animateQuestionChange(() => {
        this.currentQuestionIndex--;
        this.questionChanged.emit(this.currentQuestionIndex);

        // Only moderator should broadcast question changes
        if (this.isModerator) {
          this.lobbyService.changeQuestion(
            this.lobbyCode,
            this.currentQuestionIndex
          );
        }
      });
    }
  }

  // Helper method to animate question transitions
  private animateQuestionChange(callback: () => void): void {
    this.isAnimating = true;
    this.isAnimatingOut = true;

    // After first animation finishes, update the question and show the next one
    setTimeout(() => {
      // Execute the callback to update the question
      callback();

      // Clear the first animation class and start second animation
      this.isAnimatingOut = false;
      this.isAnimatingIn = true;

      // Remove the second animation class after it completes
      setTimeout(() => {
        this.isAnimatingIn = false;
        this.isAnimating = false;
      }, 400); // This timing should match the CSS animation duration
    }, 400); // This timing should match the CSS animation duration
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
