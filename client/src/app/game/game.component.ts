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
import {
  LobbyService,
  SubmittedAnswer,
  BuzzerJudgment,
  BuzzerRoundResult,
} from '../lobbys/lobby.service';
import { BuzzerComponent } from '../lobbys/buzzer/buzzer.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorCheckFatFill,
  phosphorFlagFill,
} from '@ng-icons/phosphor-icons/fill';
import {
  phosphorCheckFat,
  phosphorEye,
  phosphorEyeSlash,
  phosphorX,
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
      phosphorX,
      phosphorFlagFill,
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

  // Active buzzer user
  activeBuzzerUser: { socketId: string; username: string } | null = null;

  // Local state for buzzer judgment - store locally instead of sending to server
  currentBuzzerJudgment: boolean | null = null;

  // Buzzer judgment tracking
  lastJudgment: BuzzerJudgment | null = null;
  lastRoundResult: BuzzerRoundResult | null = null;

  private subscriptions: Subscription[] = [];

  // Add ViewChild reference to access the textarea element
  @ViewChild('estimationInput')
  estimationInput!: ElementRef<HTMLTextAreaElement>;

  // Add tracking for multiple choice round state
  multipleChoiceRoundCompleted = false;

  // Add new property to track answer animation state
  answerAnimationActive = false;

  // Add new property to track hiding animation state
  isHidingAnswer = false;

  // Add new property to track judged estimation answers
  estimationJudgments: { [answerId: string]: boolean } = {};

  // Add tracking for estimation round state
  estimationRoundCompleted = false;

  constructor(
    private gameService: GameService,
    private lobbyService: LobbyService
  ) {}

  ngOnInit(): void {
    // Load game data
    this.gameData = this.gameService.getGameData();
    this.setCurrentQuestion(0);

    // Check game state for initial question index with improved logging
    this.lobbyService.getGameState(this.lobbyCode).subscribe((gameState) => {
      console.log('Received game state in component:', gameState);
      if (gameState) {
        this.currentQuestionIndex = gameState.currentQuestionIndex;

        console.log('Setting visibility flags:', {
          wasQuestionVisible: this.isQuestionVisibleToParticipants,
          nowQuestionVisible: gameState.isQuestionVisible,
          wasAnswerVisible: this.isAnswerVisibleToParticipants,
          nowAnswerVisible: gameState.isAnswerVisible,
        });

        this.isQuestionVisibleToParticipants = gameState.isQuestionVisible;
        this.isAnswerVisibleToParticipants = gameState.isAnswerVisible;
        this.questionSentToParticipants = gameState.isQuestionVisible;
        this.answerSentToParticipants = gameState.isAnswerVisible;
        this.setCurrentQuestion(gameState.currentQuestionIndex);

        console.log('Updated visibility state:', {
          isQuestionVisibleToParticipants: this.isQuestionVisibleToParticipants,
          isAnswerVisibleToParticipants: this.isAnswerVisibleToParticipants,
        });
      }
    });

    // Subscribe to question visibility changes
    this.subscriptions.push(
      this.lobbyService.onQuestionVisible().subscribe(() => {
        this.isQuestionVisibleToParticipants = true;
        // Keep questionSentToParticipants in sync with visibility state
        this.questionSentToParticipants = true;
      }),
      this.lobbyService.onQuestionHidden().subscribe(() => {
        this.isQuestionVisibleToParticipants = false;
        // Keep questionSentToParticipants in sync with visibility state
        this.questionSentToParticipants = false;
      }),

      this.lobbyService.onAnswerVisible().subscribe(() => {
        // When answer becomes visible, activate animation for participants
        if (!this.isModerator) {
          this.answerAnimationActive = true;
          // Reset animation flag after animation completes
          setTimeout(() => {
            this.answerAnimationActive = false;
          }, 600); // Match animation duration
        }
        this.isAnswerVisibleToParticipants = true;
      }),
      this.lobbyService.onAnswerHidden().subscribe(() => {
        // When answer is hidden, activate hide animation for participants
        if (!this.isModerator && this.isAnswerVisibleToParticipants) {
          // First, set a flag to track that we're specifically hiding (not showing)
          this.isHidingAnswer = true;

          // Keep the element in the DOM but mark it for hiding
          this.answerAnimationActive = true;
          this.isAnswerVisibleToParticipants = false;

          // Reset animation flags after animation completes
          setTimeout(() => {
            this.answerAnimationActive = false;
            this.isHidingAnswer = false;
          }, 600); // Match animation duration
        } else {
          // For moderator, immediately update the visibility
          this.isAnswerVisibleToParticipants = false;
        }
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

    // Add subscription for active buzzer user
    this.subscriptions.push(
      this.lobbyService.getActiveBuzzerUser().subscribe((user) => {
        console.log('Active buzzer user changed:', user);
        this.activeBuzzerUser = user;
      })
    );

    // Subscribe to buzzer judgments
    this.subscriptions.push(
      this.lobbyService.onBuzzerJudgment().subscribe((judgment) => {
        console.log('Received buzzer judgment:', judgment);
        this.lastJudgment = judgment;
      })
    );

    // Subscribe to buzzer round completions
    this.subscriptions.push(
      this.lobbyService.onBuzzerRoundCompleted().subscribe((result) => {
        console.log('Buzzer round completed:', result);
        this.lastRoundResult = result;
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

      // Reset round state
      this.multipleChoiceRoundCompleted = false;
      this.estimationRoundCompleted = false;
      this.resetEstimationJudgments();

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
    console.log(`Setting question visibility to ${visible} for participants`);
    this.questionSentToParticipants = visible;
    this.lobbyService.toggleQuestionVisibility(this.lobbyCode, visible);
  }

  setAnswerVisibility(visible: boolean): void {
    console.log(`Setting answer visibility to ${visible} for participants`);
    // Automatically remove blur when moderator makes question visible
    if (visible && this.isModerator) {
      this.isAnswerBlurred = false;
    }
    // Automatically remove blur when moderator makes question visible
    if (!visible && this.isModerator) {
      this.isAnswerBlurred = true;
    }

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

      // Validate state with server before submission
      this.validateVisibilityState();

      this.lobbyService.submitAnswer(
        this.lobbyCode,
        this.currentQuestionIndex,
        this.selectedAnswer,
        'multipleChoice'
      );
      this.multipleChoiceSubmitted = true;

      // Ensure visibility state remains consistent after submission
      setTimeout(() => {
        this.validateVisibilityState();
      }, 500);
    }
  }

  // Estimation submission with additional logging
  submitEstimation(value: string): void {
    // Only proceed if NOT a moderator and value is provided
    if (!this.isModerator && value && !this.estimationSubmitted) {
      console.log('Submitting estimation:', value);
      console.log('Current visibility state before submit:', {
        isQuestionVisibleToParticipants: this.isQuestionVisibleToParticipants,
        questionSentToParticipants: this.questionSentToParticipants,
        isAnswerVisibleToParticipants: this.isAnswerVisibleToParticipants,
      });

      // Validate state with server before submission
      this.validateVisibilityState();

      this.lobbyService.submitAnswer(
        this.lobbyCode,
        this.currentQuestionIndex,
        value,
        'estimation'
      );
      this.estimationSubmitted = true;

      // Ensure visibility state remains consistent after submission
      setTimeout(() => {
        this.validateVisibilityState();
        console.log('Visibility state after submit:', {
          isQuestionVisibleToParticipants: this.isQuestionVisibleToParticipants,
          questionSentToParticipants: this.questionSentToParticipants,
          isAnswerVisibleToParticipants: this.isAnswerVisibleToParticipants,
        });
      }, 500);
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

  // New methods for buzzer judgment

  /**
   * Judge the active buzzer user's answer without completing the round
   * @param isCorrect Whether the answer is correct
   */
  judgeBuzzerAnswer(isCorrect: boolean): void {
    if (!this.activeBuzzerUser) {
      console.warn('No active buzzer user to judge');
      return;
    }

    console.log(`Judging answer as ${isCorrect ? 'correct' : 'incorrect'}`);

    // Store judgment locally
    this.currentBuzzerJudgment = isCorrect;

    // Send evaluation to server
    this.lobbyService.evaluateBuzzerAnswer(
      this.lobbyCode,
      this.activeBuzzerUser.socketId,
      isCorrect,
      this.activeBuzzerUser.username
    );
  }

  /**
   * Complete the buzzer round and award points if answer was judged correct
   */
  completeBuzzerRound(): void {
    console.log('Finalizing buzzer round');

    if (!this.activeBuzzerUser) {
      console.warn('Cannot complete round: No active buzzer user');
      return;
    }

    if (this.currentBuzzerJudgment === null) {
      console.warn('Cannot complete round: No judgment made');
      return;
    }

    // The true parameter means "add points if answer was correct"
    this.lobbyService.finalizeBuzzerRound(this.lobbyCode, true);

    // Reset the local judgment state
    this.currentBuzzerJudgment = null;
  }

  /**
   * Reset all buzzers in the lobby and clear local judgment
   */
  resetBuzzers(): void {
    console.log('Resetting buzzers');
    this.lobbyService.resetBuzzers(this.lobbyCode);
    this.currentBuzzerJudgment = null;
  }

  /**
   * Complete the multiple choice round and award points to users with correct answers
   */
  completeMultipleChoiceRound(): void {
    console.log('Completing multiple choice round');

    if (this.multipleChoiceRoundCompleted) {
      console.warn('Round already completed');
      return;
    }

    if (
      !this.currentQuestion ||
      this.currentQuestion.type !== 'multipleChoice'
    ) {
      console.warn('Not a multiple choice question');
      return;
    }

    // Show the answer to all participants
    this.setAnswerVisibility(true);

    // Get all users who selected the correct option
    // Convert correctAnswer to string to match the getUsersForOption parameter type
    const correctOption = String(this.currentQuestion.correctAnswer);
    const usersWithCorrectAnswer = this.getUsersForOption(correctOption);

    console.log(
      `Found ${usersWithCorrectAnswer.length} users with correct answer:`,
      usersWithCorrectAnswer
    );

    // Award points to each user with correct answer
    usersWithCorrectAnswer.forEach((user) => {
      // Find the socket ID for this user from the submitted answers
      const userAnswer = this.currentQuestionAnswers.find(
        (answer) => answer.username === user.username
      );

      if (userAnswer) {
        // Get the socket ID from the lobby service
        const lobby = this.lobbyService.getCurrentLobby();
        let userSocketId: string | undefined;

        if (lobby) {
          // Check if it's the moderator
          if (lobby.moderator.username === user.username) {
            userSocketId = lobby.moderator.socketId;
          } else {
            // Check regular users
            const lobbyUser = lobby.users?.find(
              (u) => u.username === user.username
            );
            if (lobbyUser) {
              userSocketId = lobbyUser.socketId;
            }
          }

          if (userSocketId) {
            console.log(
              `Awarding point to user ${user.username} with socket ID ${userSocketId}`
            );
            this.lobbyService.addPoint(this.lobbyCode, userSocketId);
          }
        }
      }
    });

    // Mark the round as completed
    this.multipleChoiceRoundCompleted = true;

    // Broadcast a message that the round is complete
    // You could also add a more formal event through the socket, similar to buzzer rounds
    this.lobbyService.sendMessage(
      this.lobbyCode,
      'Multiple Choice Runde beendet! Punkte wurden verteilt.'
    );
  }

  /**
   * Reset multiple choice round state when changing questions
   */
  resetMultipleChoiceRound(): void {
    this.multipleChoiceRoundCompleted = false;
  }

  /**
   * Judge an estimation answer - now handles toggling judgments
   * @param answer The answer to judge
   * @param isCorrect Whether the answer is correct
   */
  judgeEstimationAnswer(answer: SubmittedAnswer, isCorrect: boolean): void {
    // Create a unique ID for this answer
    const answerId = `${answer.username}-${answer.questionIndex}`;

    // If this exact judgment already exists, remove it (toggle off)
    if (this.estimationJudgments[answerId] === isCorrect) {
      delete this.estimationJudgments[answerId];
      console.log(`Removed judgment for ${answer.username}'s answer`);
      return;
    }

    // Otherwise store/update the judgment
    this.estimationJudgments[answerId] = isCorrect;
    console.log(
      `Judged ${answer.username}'s answer as ${
        isCorrect ? 'correct' : 'incorrect'
      }`
    );
  }

  /**
   * Complete the estimation round and award points to users with correct answers
   */
  completeEstimationRound(): void {
    console.log('Completing estimation round');

    if (this.estimationRoundCompleted) {
      console.warn('Estimation round already completed');
      return;
    }

    if (!this.currentQuestion || this.currentQuestion.type !== 'estimation') {
      console.warn('Not an estimation question');
      return;
    }

    // Show the answer to all participants
    this.setAnswerVisibility(true);

    // Get all users with correct judgments
    let pointsAwarded = 0;

    this.currentQuestionAnswers.forEach((answer) => {
      const answerId = `${answer.username}-${answer.questionIndex}`;

      // Check if this answer was judged correct
      if (this.estimationJudgments[answerId] === true) {
        // Find the user in the lobby
        const lobby = this.lobbyService.getCurrentLobby();
        if (!lobby) return;

        let userSocketId: string | undefined;

        // Check if it's the moderator
        if (lobby.moderator.username === answer.username) {
          userSocketId = lobby.moderator.socketId;
        } else {
          // Find user in the lobby's users list
          const lobbyUser = lobby.users?.find(
            (u) => u.username === answer.username
          );
          if (lobbyUser) {
            userSocketId = lobbyUser.socketId;
          }
        }

        // Award point if we found the user
        if (userSocketId) {
          console.log(
            `Awarding point to user ${answer.username} for correct estimation`
          );
          this.lobbyService.addPoint(this.lobbyCode, userSocketId);
          pointsAwarded++;
        }
      }
    });

    // Mark the round as completed
    this.estimationRoundCompleted = true;

    // Send message about round completion
    this.lobbyService.sendMessage(
      this.lobbyCode,
      `Schätzrunde beendet! ${pointsAwarded} Punkte wurden verteilt.`
    );
  }

  /**
   * Check if any estimation answers have been judged
   * @returns Whether any answer has been judged
   */
  hasEstimationJudgments(): boolean {
    return Object.keys(this.estimationJudgments).length > 0;
  }

  /**
   * Check if an estimation answer has been judged
   * @param answer The answer to check
   * @returns Whether the answer has been judged
   */
  isEstimationJudged(answer: SubmittedAnswer): boolean {
    const answerId = `${answer.username}-${answer.questionIndex}`;
    return answerId in this.estimationJudgments;
  }

  /**
   * Check if an estimation answer was judged correct
   * @param answer The answer to check
   * @returns Whether the answer was judged correct
   */
  isEstimationCorrect(answer: SubmittedAnswer): boolean {
    const answerId = `${answer.username}-${answer.questionIndex}`;
    return this.estimationJudgments[answerId] === true;
  }

  /**
   * Reset all estimation judgments when changing questions
   */
  private resetEstimationJudgments(): void {
    this.estimationJudgments = {};
  }

  // Add a method to specifically check and update visibility state with the server
  private validateVisibilityState(): void {
    // Get the current game state from the service to ensure flags are in sync
    const currentState = this.lobbyService.getCurrentGameState();
    if (currentState) {
      // Always keep local visibility flags in sync with the server state
      this.isQuestionVisibleToParticipants = currentState.isQuestionVisible;
      this.questionSentToParticipants = currentState.isQuestionVisible;
      this.isAnswerVisibleToParticipants = currentState.isAnswerVisible;
      this.answerSentToParticipants = currentState.isAnswerVisible;

      console.log('Validated visibility state with server:', {
        isQuestionVisible: currentState.isQuestionVisible,
        isAnswerVisible: currentState.isAnswerVisible,
      });
    }
  }
}
