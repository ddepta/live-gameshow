import {
  Component,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { Lobby, EventHistory } from '../../types';
import { BuzzerComponent } from '../buzzer/buzzer.component';
import { ChatComponent } from '../chat/chat.component';
import { GamePreviewComponent } from '../game-preview/game-preview.component';
import { InteractiveUserPanelComponent } from '../interactive-user-panel/interactive-user-panel.component';
import { GetLobbyCodeComponent } from '../get-lobby-code/get-lobby-code.component';
import { GameService } from '../../game.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { GameComponent } from '../../game/game.component';
import { ResultComponent } from '../../game/result/result.component'; // Add import for ResultComponent
import { GameData } from '../../game.service';
import { Subscription } from 'rxjs';
import {
  gameAbstract020,
  gameCloudUpload,
  gameRetroController,
  gameSave,
} from '@ng-icons/game-icons';
import { NgIcon, provideIcons } from '@ng-icons/core';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    BuzzerComponent,
    ChatComponent,
    GamePreviewComponent,
    InteractiveUserPanelComponent,
    GetLobbyCodeComponent,
    ButtonModule,
    GameComponent,
    ResultComponent,
    NgIcon,
  ],
  providers: [
    GameService,
    provideIcons({
      gameRetroController,
      gameAbstract020,
      gameSave,
    }),
  ],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
})
export class LobbyComponent implements OnInit, OnDestroy {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: EventHistory[] = [];
  isGameStarted = false;
  isGameEnded = false; // New flag to track if game has ended
  gameData: GameData | null = null;
  currentQuestionIndex = 0;
  private subscriptions: Subscription[] = [];
  isDemoQuestionsLoaded = false;

  @ViewChild(GameComponent) gameComponent?: GameComponent;
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lobbyService: LobbyService,
    private gameService: GameService
  ) {}

  ngOnInit(): void {
    // console.log('lobby init');
    this.route.params.subscribe((params: Params) => {
      this.lobbyCode = params['lobbyCode'];
      this.lobbyService.getLobby(this.lobbyCode).subscribe((result: any) => {
        // console.log('lobby result:', result);
        // Handle error case when lobby doesn't exist
        if (result.error || !result || Object.keys(result).length === 0) {
          console.error(
            'Lobby not found or error:',
            result.error || 'Empty response'
          );

          // Check if it's an authentication error
          if (result.error === 'Authentication required') {
            // Redirect to home page with lobby code as query parameter
            this.router.navigate(['/'], {
              queryParams: { lobbyCode: this.lobbyCode },
            });
          } else {
            // For other errors, just redirect to home page
            this.router.navigate(['/']);
          }
          return;
        }

        // Valid lobby found
        this.lobby = result;
        this.eventHistory = result.eventHistory ?? [];
        // console.log('Lobby loaded:', result);

        // Check for active game state and update UI accordingly
        if (result.gameState && result.gameState.isGameActive) {
          // console.log('Game is active, showing game interface');
          // Load the game data
          this.gameData = this.gameService.getGameData();

          // Set to game started to show the game UI
          this.isGameStarted = true;

          // Set the current question index from game state
          this.currentQuestionIndex = result.gameState.currentQuestionIndex;
        }
      });
    });

    // Listen for kicked events
    this.lobbyService.getKickNotifications().subscribe(() => {
      // No need to handle here as the service already redirects
    });

    // Subscribe to game events
    this.subscriptions.push(
      this.lobbyService.onGameStarted().subscribe(() => {
        if (!this.isGameStarted) {
          // console.log('Game started by moderator');
          // Only get game data if not already in game
          this.gameData = this.gameService.getGameData();
          this.isGameStarted = true;

          // Set up subscription to track question changes
          this.gameService.gameData$.subscribe((data) => {
            this.gameData = data;
          });
        }
      })
    );

    this.subscriptions.push(
      this.lobbyService.onQuestionChanged().subscribe((questionIndex) => {
        // console.log('Question changed to:', questionIndex);
        this.currentQuestionIndex = questionIndex;
      })
    );

    this.subscriptions.push(
      this.lobbyService.onGameEnded().subscribe(() => {
        // console.log('Game ended by moderator - flipping back to lobby view');
        this.isGameStarted = false;
        this.isGameEnded = true; // Set flag when game ends
      })
    );

    // Check if demo questions are already enabled
    this.isDemoQuestionsLoaded = this.gameService.isDemoQuestionsActive();

    // Subscribe to demo questions loaded events
    this.subscriptions.push(
      this.lobbyService.onDemoQuestionsLoaded().subscribe(() => {
        // console.log('Demo questions loaded event received in component');
        this.isDemoQuestionsLoaded = true;
        this.gameService.toggleDemoQuestions(true);
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  startGame(): void {
    if (this.lobby.isModerator) {
      // Get game data first before showing game UI
      this.gameData = this.gameService.getGameData();
      this.isGameStarted = true;

      // Set up subscription to track question changes
      this.gameService.gameData$.subscribe((data) => {
        this.gameData = data;
      });

      // Notify other users that game has started
      this.lobbyService.startGame(this.lobbyCode);
    } else {
      // console.log('Only the moderator can start the game.');
    }
  }

  updateQuestionIndex(index: number): void {
    this.currentQuestionIndex = index;

    // If moderator changes question, broadcast to other users
    if (this.lobby?.isModerator) {
      this.lobbyService.changeQuestion(this.lobbyCode, index);
    }
  }

  endGame(): void {
    // Return to lobby mode
    this.isGameStarted = false;
    this.isGameEnded = true; // Set flag when ending the game

    // If moderator ends game, broadcast to other users
    if (this.lobby.isModerator) {
      this.lobbyService.endGame(this.lobbyCode);
    }
  }

  loadDemoQuestions(): void {
    this.isDemoQuestionsLoaded = true;
    this.gameService.toggleDemoQuestions(true);

    // Use lobby service to broadcast to all participants
    if (this.lobby.isModerator) {
      this.lobbyService.loadDemoQuestions(this.lobbyCode);
    }
  }
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      // Currently doing nothing with the file as per requirements
      // console.log('File selected:', file.name);

      // Reset the input so the same file can be selected again
      this.fileInput.nativeElement.value = '';
    }
  }
}
