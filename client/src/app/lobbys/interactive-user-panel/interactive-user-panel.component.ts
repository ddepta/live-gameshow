import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lobby, User } from '../../types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { gameHammerDrop } from '@ng-icons/game-icons';
import { phosphorXCircleFill } from '@ng-icons/phosphor-icons/fill';
import { LobbyService } from '../lobby.service';

@Component({
  selector: 'app-interactive-user-panel',
  standalone: true,
  imports: [CommonModule, NgIcon],
  templateUrl: './interactive-user-panel.component.html',
  styleUrl: './interactive-user-panel.component.scss',
  providers: [provideIcons({ gameHammerDrop, phosphorXCircleFill })],
})
export class InteractiveUserPanelComponent {
  @Input() lobby: Lobby | undefined;

  constructor(private lobbyService: LobbyService) {}

  get moderator(): User | undefined {
    return this.lobby?.moderator;
  }

  get users(): User[] {
    return this.lobby?.users || [];
  }

  get isModerator(): boolean {
    return this.lobby?.isModerator || false;
  }

  kickUser(user: User): void {
    if (!this.isModerator || !this.lobby) return;
    console.log('kick user: ', user);

    this.lobbyService.kickUser(this.lobby.lobbyCode, user.socketId);
  }
}
