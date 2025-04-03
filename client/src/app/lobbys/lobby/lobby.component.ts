import { Component } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { Lobby, EventHistory } from '../../types';
import { BuzzerComponent } from '../buzzer/buzzer.component';
import { ChatComponent } from '../chat/chat.component';
import { GamePreviewComponent } from '../game-preview/game-preview.component';
import { InteractiveUserPanelComponent } from '../interactive-user-panel/interactive-user-panel.component';
import { GetLobbyCodeComponent } from '../get-lobby-code/get-lobby-code.component';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
  imports: [
    BuzzerComponent,
    ChatComponent,
    GamePreviewComponent,
    InteractiveUserPanelComponent,
    GetLobbyCodeComponent,
  ],
})
export class LobbyComponent {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: EventHistory[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lobbyService: LobbyService
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
}
