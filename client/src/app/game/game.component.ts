import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { GameService, GameData, Question } from '../game.service';
import { LobbyService, SubmittedAnswer } from '../lobbys/lobby.service';
import { BuzzerComponent } from '../lobbys/buzzer/buzzer.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCheckFatFill } from '@ng-icons/phosphor-icons/fill';
import {
  phosphorCheckFat,
  phosphorEye,
  phosphorEyeSlash,
} from '@ng-icons/phosphor-icons/regular';
import { typChevronLeft, typChevronRight } from '@ng-icons/typicons';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule, BuzzerComponent, ButtonModule, NgIcon],
  providers: [
    GameService,
    provideIcons({
      typChevronLeft,
      typChevronRight,
      phosphorCheckFatFill,
      phosphorCheckFat,
      phosphorEye,
      phosphorEyeSlash,
    }),
  ],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() lobbyCode: string = '';
  @Input() isModerator: boolean = false;
  @Output() questionChanged = new EventEmitter<number>();

  gameData: GameData | null = null;
  currentQuestionIndex: number = 0;
  currentQuestion: Question | null = null;
  isAnimating = false;
  isAnimatingIn = false;
  isAnimatingOut = false;
  animationDirection = '';
  isAnswerBlurred = true;

  // Answer submission tracking
  selectedAnswer: string | null = null;
  multipleChoiceSubmitted = false;
  estimationSubmitted = false;

  // Question and answer visibility control
  questionSentToParticipants = false;
  answerSentToParticipants = false;
  isQuestionVisibleToParticipants = false;
  isAnswerVisibleToParticipants = false;

  // Submitted answers from all users
  submittedAnswers: SubmittedAnswer[] = [];
  currentQuestionAnswers: SubmittedAnswer[] = [];

  private subscriptions: Subscription[] = [];

  // Add ViewChild reference to access the textarea element
  @ViewChild('estimationInput')
  estimationInput!: ElementRef<HTMLTextAreaElement>;

  constructor(
    private gameService: GameService,
    private lobbyService: LobbyService
  ) {}

  ngOnInit(): void {
    // Load game data
    this.gameData = this.gameService.getGameData();
    this.setCurrentQuestion(0);

    // Check game state for initial question index
    this.lobbyService.getGameState(this.lobbyCode).subscribe((gameState) => {
      if (gameState) {
        this.currentQuestionIndex = gameState.currentQuestionIndex;
        this.isQuestionVisibleToParticipants = gameState.isQuestionVisible;
        this.isAnswerVisibleToParticipants = gameState.isAnswerVisible;
        this.questionSentToParticipants = gameState.isQuestionVisible;
        this.answerSentToParticipants = gameState.isAnswerVisible;
        this.setCurrentQuestion(gameState.currentQuestionIndex);
      }
    });

    // Subscribe to question visibility changes
    this.subscriptions.push(
      this.lobbyService.onQuestionVisible().subscribe(() => {
        this.isQuestionVisibleToParticipants = true;
      }),
      this.lobbyService.onQuestionHidden().subscribe(() => {
        this.isQuestionVisibleToParticipants = false;
      }),
      this.lobbyService.onAnswerVisible().subscribe(() => {
        this.isAnswerVisibleToParticipants = true;
      }),
      this.lobbyService.onAnswerHidden().subscribe(() => {
        this.isAnswerVisibleToParticipants = false;
      }),

      // Update the question changed subscription to handle animations for participants
      this.lobbyService.onQuestionChanged().subscribe((index) => {
        // For participants, we need to animate the transition
        if (!this.isModerator) {
          // Determine animation direction based on index change
          const direction = index > this.currentQuestionIndex ? 'next' : 'prev';

          // Trigger animation with the correct direction
          this.animateQuestionTransition(direction, index);
        } else {
          // For moderator, just update without animation (they control the navigation)
          // Reset submission state when question changes
          this.selectedAnswer = null;
          this.multipleChoiceSubmitted = false;
          this.estimationSubmitted = false;
          this.setCurrentQuestion(index);
        }
      })
    );

    // Subscribe to submitted answers
    this.subscriptions.push(
      this.lobbyService.getAnswers().subscribe((answers) => {
        console.log('Received answers in component:', answers);
        this.submittedAnswers = answers;
        this.updateCurrentQuestionAnswers();
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setCurrentQuestion(index: number): void {
    if (
      this.gameData &&
      this.gameData.questions &&
      this.gameData.questions.length > index
    ) {
      this.currentQuestionIndex = index;
      this.currentQuestion = this.gameData.questions[index];
      this.questionChanged.emit(index);
      this.updateCurrentQuestionAnswers();
    }
  }

  private updateCurrentQuestionAnswers(): void {
    // Filter answers to only include those for the current question index
    this.currentQuestionAnswers = this.submittedAnswers.filter(
      (answer) => answer.questionIndex === this.currentQuestionIndex
    );

    console.log(
      'Filtered answers for current question:',
      this.currentQuestionAnswers
    );

    // Check if current user already submitted an answer
    if (!this.isModerator) {
      const username = localStorage.getItem('username');
      const userAnswer = this.currentQuestionAnswers.find(
        (a) => a.username === username
      );

      if (userAnswer) {
        if (userAnswer.type === 'multipleChoice') {
          this.selectedAnswer = userAnswer.answer;
          this.multipleChoiceSubmitted = true;
        } else if (userAnswer.type === 'estimation') {
          this.estimationSubmitted = true;
        }
      } else {
        // Reset submission state if no answer found for current question
        this.selectedAnswer = null;
        this.multipleChoiceSubmitted = false;
        this.estimationSubmitted = false;
      }
    }
  }

  // Navigation methods
  previousQuestion(): void {
    if (this.currentQuestionIndex > 0 && !this.isAnimating) {
      this.animateQuestionChange('prev');
    }
  }

  nextQuestion(): void {
    if (
      this.gameData &&
      this.currentQuestionIndex < this.gameData.questions.length - 1 &&
      !this.isAnimating
    ) {
      this.animateQuestionChange('next');
    }
  }

  private animateQuestionChange(direction: 'next' | 'prev'): void {
    this.isAnimating = true;
    this.isAnimatingOut = true;
    this.animationDirection = direction;

    setTimeout(() => {
      this.isAnimatingOut = false;
      this.isAnimatingIn = true;

      if (direction === 'next') {
        this.setCurrentQuestion(this.currentQuestionIndex + 1);
      } else {
        this.setCurrentQuestion(this.currentQuestionIndex - 1);
      }

      // Reset visibility state for new question
      this.questionSentToParticipants = false;
      this.answerSentToParticipants = false;

      // Reset selection state when changing questions
      this.selectedAnswer = null;
      this.multipleChoiceSubmitted = false;
      this.estimationSubmitted = false;

      // Always reset the answer blur when changing questions
      this.isAnswerBlurred = true;

      // Notify server about question change (for moderator only)
      if (this.isModerator) {
        this.lobbyService.changeQuestion(
          this.lobbyCode,
          this.currentQuestionIndex
        );
      }

      // Make sure to update the displayed answers for the new question
      this.updateCurrentQuestionAnswers();

      setTimeout(() => {
        this.isAnimatingIn = false;
        this.isAnimating = false;
      }, 300);
    }, 300);
  }

  // Add a new method to handle animated transitions for participants
  private animateQuestionTransition(
    direction: 'next' | 'prev',
    newIndex: number
  ): void {
    this.isAnimating = true;
    this.isAnimatingOut = true;
    this.animationDirection = direction;

    // Reset states for the transition
    this.selectedAnswer = null;
    this.multipleChoiceSubmitted = false;
    this.estimationSubmitted = false;

    // First part of animation - fade out current question
    setTimeout(() => {
      this.isAnimatingOut = false;
      this.isAnimatingIn = true;

      // Update to the new question
      this.setCurrentQuestion(newIndex);

      // Reset visibility based on server state
      // Note: We don't change visibility here as it's controlled by the moderator

      // Second part of animation - fade in new question
      setTimeout(() => {
        this.isAnimatingIn = false;
        this.isAnimating = false;
      }, 300);
    }, 300);
  }

  // Toggle answer blur effect
  toggleAnswerBlur(): void {
    this.isAnswerBlurred = !this.isAnswerBlurred;
  }

  // Question & answer visibility control for moderator
  setQuestionVisibility(visible: boolean): void {
    this.questionSentToParticipants = visible;
    this.lobbyService.toggleQuestionVisibility(this.lobbyCode, visible);
  }

  setAnswerVisibility(visible: boolean): void {
    this.answerSentToParticipants = visible;
    this.lobbyService.toggleAnswerVisibility(this.lobbyCode, visible);
  }

  // Multiple choice selection and submission
  selectAnswer(option: string): void {
    if (!this.multipleChoiceSubmitted) {
      this.selectedAnswer = option;
    }
  }

  confirmMultipleChoice(): void {
    if (this.selectedAnswer && !this.multipleChoiceSubmitted) {
      console.log('Submitting multiple choice answer:', this.selectedAnswer);
      this.lobbyService.submitAnswer(
        this.lobbyCode,
        this.currentQuestionIndex,
        this.selectedAnswer,
        'multipleChoice'
      );
      this.multipleChoiceSubmitted = true;
    }
  }

  // Estimation submission
  submitEstimation(value: string): void {
    // Only proceed if NOT a moderator and value is provided
    if (!this.isModerator && value && !this.estimationSubmitted) {
      console.log('Submitting estimation:', value);
      this.lobbyService.submitAnswer(
        this.lobbyCode,
        this.currentQuestionIndex,
        value,
        'estimation'
      );
      this.estimationSubmitted = true;
    }
  }

  // Adjust font size for estimation input
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
      if (contentLength > 5) fontSize = 12;
      if (contentLength > 9) fontSize = 9;
      if (contentLength > 12) fontSize = 7;
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

  // Get users who selected a specific option for multiple choice questions
  getUsersForOption(option: string): { username: string }[] {
    if (
      !this.currentQuestionAnswers ||
      this.currentQuestionAnswers.length === 0
    ) {
      return [];
    }

    return this.currentQuestionAnswers
      .filter(
        (answer) => answer.type === 'multipleChoice' && answer.answer === option
      )
      .map((answer) => ({
        username: answer.username,
      }));
  }

  // Listen for window resize to adjust layout
  @HostListener('window:resize')
  onResize(): void {
    // Implement any responsive adjustments if needed
  }
}
