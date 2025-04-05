import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  animate,
  style,
  transition,
  trigger,
  query,
  stagger,
  animateChild,
  group,
} from '@angular/animations';
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
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px) rotateX(-30deg)' }),
        animate(
          '400ms ease-out',
          style({ opacity: 1, transform: 'translateY(0) rotateX(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '400ms ease-in',
          style({ opacity: 0, transform: 'translateY(-20px) rotateX(30deg)' })
        ),
      ]),
    ]),
    trigger('pageAnimation', [
      transition('preview => game', [
        // Set up the container
        style({ perspective: '1000px' }),

        // Front side (preview) animation
        query('.preview-side', [
          style({
            position: 'absolute',
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d',
            transform: 'rotateY(0deg)',
            width: '100%',
          }),
          animate(
            '800ms ease-in',
            style({
              transform: 'rotateY(180deg)',
            })
          ),
        ]),

        // Back side (game) animation
        query(
          '.game-side',
          [
            style({
              position: 'absolute',
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
              transform: 'rotateY(-180deg)',
              width: '100%',
            }),
            animate(
              '800ms ease-in',
              style({
                transform: 'rotateY(0deg)',
              })
            ),
          ],
          { optional: true }
        ),
      ]),

      transition('game => preview', [
        // Set up the container
        style({ perspective: '1000px' }),

        // Back side (game) animation
        query('.game-side', [
          style({
            position: 'absolute',
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d',
            transform: 'rotateY(0deg)',
            width: '100%',
          }),
          animate(
            '800ms ease-in',
            style({
              transform: 'rotateY(-180deg)',
            })
          ),
        ]),

        // Front side (preview) animation
        query(
          '.preview-side',
          [
            style({
              position: 'absolute',
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
              transform: 'rotateY(180deg)',
              width: '100%',
            }),
            animate(
              '800ms ease-in',
              style({
                transform: 'rotateY(0deg)',
              })
            ),
          ],
          { optional: true }
        ),
      ]),
    ]),
  ],
})
export class LobbyComponent implements OnInit {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: EventHistory[] = [];
  isGameStarted = false; // Track whether game is started
  gameData: GameData | null = null;
  currentQuestionIndex = 0;
  animationState: 'preview' | 'game' = 'preview';

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
  }

  startGame(): void {
    if (this.lobby.isModerator) {
      // Get game data first before showing game UI
      this.gameData = this.gameService.getGameData();
      this.isGameStarted = true;
      this.animationState = 'game'; // Update animation state

      // Set up subscription to track question changes
      this.gameService.gameData$.subscribe((data) => {
        this.gameData = data;
      });

      // Notify other users that game has started
      // You might want to add a socket event here to notify other users
    } else {
      console.log('Only the moderator can start the game.');
    }
  }

  // Add method to update question index
  updateQuestionIndex(index: number): void {
    this.currentQuestionIndex = index;
  }

  endGame(): void {
    // Return to lobby mode
    this.isGameStarted = false;
    this.animationState = 'preview'; // Update animation state
  }
}
