import { Component } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { Lobby, Event } from '../../types';
import { BuzzerComponent } from '../buzzer/buzzer.component';
import { EventHistoryComponent } from '../event-history/event-history.component';
// import { Event, Lobby } from 'src/app/types';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
  imports: [BuzzerComponent, EventHistoryComponent],
})
export class LobbyComponent {
  lobbyCode!: string;
  lobby!: Lobby;
  eventHistory: Event[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lobbyService: LobbyService
  ) {}

  ngOnInit(): void {
    console.log('lobby');
    // this.lobbyCode = this.route.snapshot.paramMap.get('id') ?? '';
    this.route.params.subscribe((params: Params) => {
      this.lobbyCode = params['lobbyCode'];
      this.lobbyService.getLobby(this.lobbyCode).subscribe((result: any) => {
        if (result.error) {
          this.router.navigate(['/']);
        } else {
          this.lobby = result;
          this.eventHistory = result.eventHistory;
        }

        console.log('result: ', result);
      });
      console.log(params);
    });
  }
}
