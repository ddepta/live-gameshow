import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { Router } from '@angular/router';
import { SocketService } from '../socket.service';
import {
  Lobby,
  User,
  BuzzerState,
  EventHistory,
  JoinLobbyResponse,
  UserListUpdate,
} from '../types';

export interface GameState {
  isGameActive: boolean;
  currentQuestionIndex: number;
  isQuestionVisible: boolean;
  isAnswerVisible: boolean;
}

// Add these new interfaces
export interface SubmittedAnswer {
  username: string;
  questionIndex: number;
  answer: string;
  type: 'multipleChoice' | 'estimation';
  timestamp: number;
}

export interface AnswerUpdate {
  lobbyCode: string;
  answers: SubmittedAnswer[];
}

@Injectable({
  providedIn: 'root',
})
export class LobbyService {
  // Existing subjects
  joinLobbySubject = new Subject<any>();
  lobbySubject = new Subject<Lobby>();
  lobbyJoinSubect = new Subject<any>();
  lobbyKickedSubject = new Subject<any>();
  userListSubject = new Subject<string>(); // Subject for user list updates

  // Game event subjects
  gameStartedSubject = new Subject<boolean>();
  questionChangedSubject = new Subject<number>();
  gameEndedSubject = new Subject<boolean>();

  // New subjects for question and answer visibility
  private questionVisibleSubject = new Subject<void>();
  private answerVisibleSubject = new Subject<void>();

  // Add game state subject
  private gameStateSubject = new BehaviorSubject<GameState | null>(null);

  // Add subjects for question and answer hidden events
  private questionHiddenSubject = new Subject<void>();
  private answerHiddenSubject = new Subject<void>();

  // Override the answersSubject with a new instance to ensure changes are detected
  private answersSubject = new BehaviorSubject<SubmittedAnswer[]>([]);

  private currentLobby: Lobby | null = null;
  private socket!: Socket;

  constructor(private socketService: SocketService, private router: Router) {
    this.socket = this.socketService.getSocket();

    // Listen for kicked event
    this.socket.on('lobby:kicked', (data) => {
      this.lobbyKickedSubject.next(data);
      // Redirect to home when kicked
      this.router.navigate(['/']);
    });

    // Listen for user list updates
    this.socket.on('lobby:userList', (update: UserListUpdate) => {
      console.log('User list updated:', update);

      // Update the current lobby if it matches
      if (
        this.currentLobby &&
        this.currentLobby.lobbyCode === update.lobbyCode
      ) {
        this.currentLobby.users = update.users;
        this.currentLobby.moderator = update.moderator;

        // Notify subscribers that the user list has changed
        this.userListSubject.next(update.lobbyCode);
      }
    });

    // Listen for game started event
    this.socket.on('game:started', () => {
      console.log('Game started event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isGameActive: true,
        });
      }
      this.gameStartedSubject.next(true);
    });

    // Listen for question changed event
    this.socket.on('game:question:change', (questionIndex: number) => {
      console.log('Question changed to:', questionIndex);
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          currentQuestionIndex: questionIndex,
          isQuestionVisible: false,
          isAnswerVisible: false,
        });
      }
      this.questionChangedSubject.next(questionIndex);
    });

    // Listen for game ended event
    this.socket.on('game:ended', () => {
      console.log('Game ended event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isGameActive: false,
        });
      }
      this.gameEndedSubject.next(true);
    });

    // Add new handlers for question and answer visibility using socket.on
    this.socket.on('game:questionVisible', () => {
      console.log('Question visible event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isQuestionVisible: true,
        });
      }
      this.questionVisibleSubject.next();
    });

    this.socket.on('game:answerVisible', () => {
      console.log('Answer visible event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isAnswerVisible: true,
        });
      }
      this.answerVisibleSubject.next();
    });

    // Add listeners for question and answer hidden events
    this.socket.on('game:questionHidden', () => {
      console.log('Question hidden event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isQuestionVisible: false,
        });
      }
      this.questionHiddenSubject.next();
    });

    this.socket.on('game:answerHidden', () => {
      console.log('Answer hidden event received');
      if (this.gameStateSubject.value) {
        this.gameStateSubject.next({
          ...this.gameStateSubject.value,
          isAnswerVisible: false,
        });
      }
      this.answerHiddenSubject.next();
    });

    // Enhanced listener for submitted answers - with more explicit handling
    this.socket.on('game:answers', (update: AnswerUpdate) => {
      console.log('Received answer update with payload:', update);

      if (
        this.currentLobby &&
        this.currentLobby.lobbyCode === update.lobbyCode
      ) {
        console.log('Processing answers for current lobby');

        // Extract the answers and ensure we're dealing with a proper array
        const answers = Array.isArray(update.answers) ? update.answers : [];

        // Log each answer for debugging
        answers.forEach((answer) => {
          console.log(
            `Answer in service - username: ${answer.username}, question: ${answer.questionIndex}, value: ${answer.answer}`
          );
        });

        // Create a new array to trigger change detection
        const newAnswers = [...answers];

        // Explicitly set the new value
        this.answersSubject.next(newAnswers);

        // Log the current value of the subject
        console.log(
          'Current value of answersSubject:',
          this.answersSubject.value
        );
      }
    });
  }

  public joinLobby(username: string, lobbyCode?: string) {
    this.socket.emit(
      'lobby:join',
      lobbyCode,
      username,
      (response: JoinLobbyResponse) => {
        this.joinLobbySubject.next(response);
      }
    );
    return this.joinLobbySubject;
  }

  public getLobby(lobbyCode: string) {
    this.socket.emit('lobby:get', lobbyCode, (response: Lobby) => {
      if (!response.error) {
        this.currentLobby = response; // Store the lobby data

        // Update game state if available
        if (response.gameState) {
          this.gameStateSubject.next(response.gameState);
        }
      }
      this.lobbySubject.next(response);
    });
    return this.lobbySubject;
  }

  public getLobbyJoins = () => {
    console.log('lobby joinded');
    this.socket.on('lobby:joined', (message) => {
      this.lobbyJoinSubect.next(message);
    });
    return this.lobbyJoinSubect;
  };

  public kickUser(lobbyCode: string, userSocketId: string) {
    this.socket.emit('lobby:kick', lobbyCode, userSocketId);
  }

  public getKickNotifications(): Observable<any> {
    return this.lobbyKickedSubject.asObservable();
  }

  // New method to get user list updates
  public getLobbyUpdates(): Observable<string> {
    return this.userListSubject.asObservable();
  }

  // Method to get the current lobby data
  public getCurrentLobby(): Lobby | null {
    return this.currentLobby;
  }

  // New methods for game synchronization
  public startGame(lobbyCode: string): void {
    console.log('Emitting game:start event for lobby:', lobbyCode);
    this.socket.emit('game:start', lobbyCode);
  }

  public changeQuestion(lobbyCode: string, questionIndex: number): void {
    console.log('Emitting game:question:change event:', questionIndex);
    this.socket.emit('game:question:change', lobbyCode, questionIndex);
  }

  public endGame(lobbyCode: string): void {
    console.log('Emitting game:end event for lobby:', lobbyCode);
    this.socket.emit('game:end', lobbyCode);
  }

  // Methods to emit events
  sendQuestion(lobbyCode: string): void {
    this.socket.emit('game:sendQuestion', lobbyCode);
  }

  sendAnswer(lobbyCode: string): void {
    this.socket.emit('game:sendAnswer', lobbyCode);
  }

  // Methods to emit hide events
  hideQuestion(lobbyCode: string): void {
    this.socket.emit('game:hideQuestion', lobbyCode);
  }

  hideAnswer(lobbyCode: string): void {
    this.socket.emit('game:hideAnswer', lobbyCode);
  }

  // Methods to toggle visibility of questions and answers
  toggleQuestionVisibility(lobbyCode: string, visible: boolean): void {
    if (visible) {
      this.sendQuestion(lobbyCode);
    } else {
      this.hideQuestion(lobbyCode);
    }
  }

  toggleAnswerVisibility(lobbyCode: string, visible: boolean): void {
    if (visible) {
      this.sendAnswer(lobbyCode);
    } else {
      this.hideAnswer(lobbyCode);
    }
  }

  // Methods to listen for events - updated to use the subjects
  onQuestionVisible(): Observable<void> {
    return this.questionVisibleSubject.asObservable();
  }

  onAnswerVisible(): Observable<void> {
    return this.answerVisibleSubject.asObservable();
  }

  // Observables for hidden events
  onQuestionHidden(): Observable<void> {
    return this.questionHiddenSubject.asObservable();
  }

  onAnswerHidden(): Observable<void> {
    return this.answerHiddenSubject.asObservable();
  }

  // Observables for game events
  public onGameStarted(): Observable<boolean> {
    return this.gameStartedSubject.asObservable();
  }

  public onQuestionChanged(): Observable<number> {
    return this.questionChangedSubject.asObservable();
  }

  public onGameEnded(): Observable<boolean> {
    return this.gameEndedSubject.asObservable();
  }

  // Add method to explicitly get game state
  public getGameState(lobbyCode: string): Observable<GameState | null> {
    this.socket.emit(
      'game:getState',
      lobbyCode,
      (response: GameState | { error: string }) => {
        if ('error' in response) {
          console.error('Error getting game state:', response.error);
        } else {
          console.log('Received game state:', response);
          this.gameStateSubject.next(response);
        }
      }
    );
    return this.gameStateSubject.asObservable();
  }

  // Method to access current game state
  public getCurrentGameState(): GameState | null {
    return this.gameStateSubject.value;
  }

  // Method to submit answers
  submitAnswer(
    lobbyCode: string,
    questionIndex: number,
    answer: string,
    type: 'multipleChoice' | 'estimation'
  ): void {
    console.log('Submitting answer:', {
      lobbyCode,
      questionIndex,
      answer,
      type,
    });
    this.socket.emit(
      'game:submitAnswer',
      lobbyCode,
      questionIndex,
      answer,
      type
    );
  }

  // Enhanced method for getting answers
  getAnswers(): Observable<SubmittedAnswer[]> {
    console.log('getAnswers called, current value:', this.answersSubject.value);

    // Force a new emission with the current value to ensure subscribers receive it
    setTimeout(() => {
      const currentValue = this.answersSubject.value;
      this.answersSubject.next([...currentValue]);
    }, 0);

    return this.answersSubject.asObservable();
  }
}
