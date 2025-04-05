import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, GameData, Question } from '../game.service';
import { LobbyService } from '../lobbys/lobby.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BuzzerComponent } from '../lobbys/buzzer/buzzer.component';
import { Subscription } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { typChevronLeft, typChevronRight } from '@ng-icons/typicons';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { phosphorCheckFatFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCheckFat } from '@ng-icons/phosphor-icons/regular';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    BuzzerComponent,
    NgIconComponent,
    ButtonModule,
    InputTextModule,
    TextareaModule, // Import PrimeNG ButtonModule instead of ToggleButtonModule
  ],
  providers: [
    GameService,
    provideIcons({
      typChevronLeft,
      typChevronRight,
      phosphorCheckFatFill,
      phosphorCheckFat,
    }),
  ],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit, OnDestroy, AfterViewInit {
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

  // Track if answer should be blurred
  isAnswerBlurred = true;

  // Track selected answer
  selectedAnswer: string | null = null;

  // Add a state variable to track submission status
  estimationSubmitted = false;

  // Add a state variable to track multiple choice submission status
  multipleChoiceSubmitted = false;

  @ViewChild('estimationInput') estimationInputRef?: ElementRef;

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

  ngAfterViewInit() {
    // Focus the estimation input if it exists
    this.focusEstimationInput();
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
    this.isAnswerBlurred = true; // Reset blur state for new question
    this.selectedAnswer = null; // Reset selected answer for new question
    this.estimationSubmitted = false; // Reset estimation submission state
    this.multipleChoiceSubmitted = false; // Reset multiple choice submission state

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
        this.focusEstimationInput(); // Focus the input after animation
      }, 400); // This timing should match the CSS animation duration
    }, 400); // This timing should match the CSS animation duration
  }

  // Toggle blur state on answer click
  toggleAnswerBlur(): void {
    this.isAnswerBlurred = !this.isAnswerBlurred;
  }

  backToLobby(): void {
    this.router.navigate(['/lobby', this.lobbyCode]);
  }

  // Update select answer method to just track selection without submitting
  selectAnswer(option: string): void {
    // Only allow selection if not already submitted
    if (!this.multipleChoiceSubmitted) {
      console.log('Selected answer:', option);
      this.selectedAnswer = option;
    }
  }

  // New method to confirm multiple choice selection
  confirmMultipleChoice(): void {
    if (this.selectedAnswer) {
      console.log('Confirmed multiple choice answer:', this.selectedAnswer);
      this.multipleChoiceSubmitted = true;
      // Here you would handle the answer submission logic
      // For example, checking if it's correct and maybe moving to the next question
    } else {
      console.error('No option selected');
    }
  }

  submitEstimation(value: string): void {
    if (value) {
      console.log('Submitted estimation:', value);
      // Set to true (don't toggle) so button stays in filled state
      this.estimationSubmitted = true;
      // Here you would handle the estimation submission logic
      // For example, checking how close it is to the correct answer
    } else {
      console.error('Invalid estimation value');
      // Handle invalid input
    }
  }

  // Method to adjust font size based on content
  adjustFontSize(input: HTMLTextAreaElement) {
    if (!input) return;

    // Default large size
    let fontSize = 10; // in vh units

    // If content is too long, reduce font size
    const contentLength = input.value.length;

    if (contentLength > 0) {
      fontSize = 15; // Default large size
      // Simple algorithm: reduce font size as content grows
      // Adjust these numbers based on your specific input field size
      if (contentLength > 5) fontSize = 13;
      if (contentLength > 9) fontSize = 10;
      if (contentLength > 12) fontSize = 8;
      if (contentLength > 16) fontSize = 4.5;
      if (contentLength > 20) {
        input.style.lineHeight = '7vh';
      } else {
        input.style.lineHeight = '22vh';
      }

      input.style.fontSize = `${fontSize}vh`;
    } else {
      input.style.fontSize = `${fontSize}vh`;
    }
  }

  // Focus the estimation input when the component loads or question changes
  focusEstimationInput() {
    setTimeout(() => {
      if (
        this.estimationInputRef &&
        this.currentQuestion?.type === 'estimation'
      ) {
        this.estimationInputRef.nativeElement.focus();
      }
    }, 500);
  }
}
