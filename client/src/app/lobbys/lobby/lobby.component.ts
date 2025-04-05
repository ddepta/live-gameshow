import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
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
import { GameData } from '../../game.service';
import { Subscription } from 'rxjs';

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
    GameComponent, // Add GameComponent to the imports
  ],
  providers: [GameService],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
})
export class LobbyComponent implements OnInit, OnDestroy {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: EventHistory[] = [];
  isGameStarted = false;
  gameData: GameData | null = null;
  currentQuestionIndex = 0;
  private subscriptions: Subscription[] = [];

  @ViewChild(GameComponent) gameComponent?: GameComponent;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lobbyService: LobbyService,
    private gameService: GameService
  ) {}

  ngOnInit(): void {
    console.log('lobby init');
    this.route.params.subscribe((params: Params) => {
      this.lobbyCode = params['lobbyCode'];
      this.lobbyService.getLobby(this.lobbyCode).subscribe((result: any) => {
        console.log('lobby result:', result);
        // Handle error case when lobby doesn't exist
        if (result.error || !result || Object.keys(result).length === 0) {
          console.error(
            'Lobby not found or error:',
            result.error || 'Empty response'
          );
          // Redirect to home page
          this.router.navigate(['/']);
          return;
        }

        // Valid lobby found
        this.lobby = result;
        this.eventHistory = result.eventHistory ?? [];
        console.log('Lobby loaded:', result);
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
          console.log('Game started by moderator');
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
        console.log('Question changed to:', questionIndex);
        this.currentQuestionIndex = questionIndex;
      })
    );

    this.subscriptions.push(
      this.lobbyService.onGameEnded().subscribe(() => {
        console.log('Game ended by moderator - flipping back to lobby view');
        this.isGameStarted = false;
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
      console.log('Only the moderator can start the game.');
    }
  }

  updateQuestionIndex(index: number): void {
    this.currentQuestionIndex = index;

    // If moderator changes question, broadcast to other users
    if (this.lobby.isModerator) {
      this.lobbyService.changeQuestion(this.lobbyCode, index);
    }
  }

  endGame(): void {
    // Return to lobby mode
    this.isGameStarted = false;

    // If moderator ends game, broadcast to other users
    if (this.lobby.isModerator) {
      this.lobbyService.endGame(this.lobbyCode);
    }
  }
}
