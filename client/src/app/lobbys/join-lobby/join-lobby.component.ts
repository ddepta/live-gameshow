import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-join-lobby',
  templateUrl: './join-lobby.component.html',
  styleUrls: ['./join-lobby.component.scss'],
  imports: [FormsModule],
})
export class JoinLobbyComponent implements OnInit {
  lobbyCode!: string;
  username!: string;

  constructor(private lobbyService: LobbyService, private router: Router) {}

  ngOnInit() {
    this.username = localStorage.getItem('username') || '';
  }

  joinLobby() {
    this.lobbyService
      .joinLobby(this.username, this.lobbyCode)
      .subscribe((result: any) => {
        console.log('result: ', result);
        if (result !== 'error') {
          localStorage.setItem('jwt_token', result.token);
          localStorage.setItem('username', result.username);
          this.router.navigate(['/lobby', result.lobbyCode]);
        }
      });
  }

  createLobby() {
    this.lobbyService.joinLobby(this.username);
  }
}
