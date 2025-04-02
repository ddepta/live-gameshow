import { Component } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { Lobby, EventHistory } from '../../types';
import { BuzzerComponent } from '../buzzer/buzzer.component';
import { ChatComponent } from '../chat/chat.component';
import { GamePreviewComponent } from '../game-preview/game-preview.component';
import { InteractiveUserPanelComponent } from '../interactive-user-panel/interactive-user-panel.component';
import { GetLobbyCodeComponent } from '../get-lobby-code/get-lobby-code.component';
// import { Event, Lobby } from 'src/app/types';

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
    // this.lobbyCode = this.route.snapshot.paramMap.get('id') ?? '';
    this.route.params.subscribe((params: Params) => {
      this.lobbyCode = params['lobbyCode'];
      this.lobbyService.getLobby(this.lobbyCode).subscribe((result: Lobby) => {
        if (!result || Object.keys(result).length === 0) {
          this.router.navigate(['/']);
        } else {
          this.lobby = result;
          this.eventHistory = result.eventHistory ?? [];
        }

        console.log('result: ', result);
      });
      console.log(params);
    });
  }
}
