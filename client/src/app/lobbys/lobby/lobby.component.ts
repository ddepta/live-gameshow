import { Component, OnInit } from '@angular/core';
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
  ],
  providers: [GameService],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
})
export class LobbyComponent implements OnInit {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: EventHistory[] = [];

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
      // Navigate to the game page with the lobby code
      this.router.navigate(['/game', this.lobbyCode]);
    } else {
      console.log('Only the moderator can start the game.');
    }
  }
}
