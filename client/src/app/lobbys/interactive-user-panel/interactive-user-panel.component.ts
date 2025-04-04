import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lobby, User } from '../../types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { gameHammerDrop } from '@ng-icons/game-icons';
import { phosphorXCircleFill } from '@ng-icons/phosphor-icons/fill';
import { LobbyService } from '../lobby.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-interactive-user-panel',
  standalone: true,
  imports: [CommonModule, NgIcon],
  templateUrl: './interactive-user-panel.component.html',
  styleUrl: './interactive-user-panel.component.scss',
  providers: [provideIcons({ gameHammerDrop, phosphorXCircleFill })],
})
export class InteractiveUserPanelComponent implements OnInit, OnDestroy {
  @Input() lobby: Lobby | undefined;

  private subscriptions: Subscription[] = [];

  constructor(
    private lobbyService: LobbyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to user list updates
    this.subscriptions.push(
      this.lobbyService.getLobbyUpdates().subscribe((lobbyCode) => {
        if (this.lobby && this.lobby.lobbyCode === lobbyCode) {
          // Update our local lobby with the latest data
          const updatedLobby = this.lobbyService.getCurrentLobby();
          if (updatedLobby) {
            this.lobby = updatedLobby;
            this.cdr.detectChanges(); // Force UI update
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get moderator(): User | undefined {
    return this.lobby?.moderator;
  }

  get users(): User[] {
    return this.lobby?.users || [];
  }

  get isModerator(): boolean {
    return this.lobby?.isModerator || false;
  }

  // New getters for the template to use
  get displayedModerator(): User | undefined {
    return this.moderator;
  }

  get displayedUsers(): User[] {
    // Filter out the moderator from the users list if it's included
    return this.users.filter(
      (user) => this.moderator && user.socketId !== this.moderator.socketId
    );
  }

  kickUser(user: User): void {
    if (!this.isModerator || !this.lobby) return;
    console.log('kick user: ', user);

    this.lobbyService.kickUser(this.lobby.lobbyCode, user.socketId);
  }
}
