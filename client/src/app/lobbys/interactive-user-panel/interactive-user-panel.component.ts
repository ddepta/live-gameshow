import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lobby, User } from '../../types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { gameHammerDrop } from '@ng-icons/game-icons';
import { phosphorXCircleFill } from '@ng-icons/phosphor-icons/fill';
import { LobbyService } from '../lobby.service';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-interactive-user-panel',
  standalone: true,
  imports: [CommonModule, NgIcon, ButtonModule],
  templateUrl: './interactive-user-panel.component.html',
  styleUrl: './interactive-user-panel.component.scss',
  providers: [provideIcons({ gameHammerDrop, phosphorXCircleFill })],
})
export class InteractiveUserPanelComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() lobby: Lobby | undefined;

  private userAvatars = new Map<string, string>();
  private avatarsLoading = false;

  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private lobbyService: LobbyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // console.log('InteractiveUserPanelComponent initialized');

    // Subscribe to user list updates
    this.subscriptions.push(
      this.lobbyService.getLobbyUpdates().subscribe((lobbyCode) => {
        // console.log('Lobby updated:', lobbyCode);
        if (this.lobby && this.lobby.lobbyCode === lobbyCode) {
          // Update our local lobby with the latest data
          const updatedLobby = this.lobbyService.getCurrentLobby();
          if (updatedLobby) {
            this.lobby = updatedLobby;
            // Load avatars AFTER lobby is updated
            this.loadAllUserAvatars();
            this.cdr.detectChanges(); // Force UI update
          }
        }
      })
    );

    // Subscribe to point updates
    this.lobbyService
      .onPointUpdated()
      .pipe(takeUntil(this.destroy$))
      .subscribe((updatedUser) => {
        this.updateUserPoints(updatedUser);
      });

    this.lobbyService
      .onAllPointsReset()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Force refresh lobby data
        if (this.lobby) {
          const updatedLobby = this.lobbyService.getCurrentLobby();
          if (updatedLobby) {
            this.lobby = updatedLobby;
            this.cdr.detectChanges();
          }
        }
      });

    // Only load avatars if lobby data is already available on init
    if (this.lobby && this.lobby.lobbyCode) {
      // console.log('Lobby already available on init, loading avatars');
      this.loadAllUserAvatars();
    } else {
      // console.log(
      //   'Lobby not available on init, will load avatars when lobby data arrives'
      // );
    }
  }

  // React to input changes (when lobby is passed from parent)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lobby'] && changes['lobby'].currentValue) {
      // console.log('Lobby input changed, loading avatars');
      this.loadAllUserAvatars();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();
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
    // console.log('kick user: ', user);

    this.lobbyService.kickUser(this.lobby.lobbyCode, user.socketId);
  }

  // Point management methods
  addPoint(user: User): void {
    if (!this.isModerator || !this.lobby) return;
    this.lobbyService.addPoint(this.lobby.lobbyCode, user.socketId);
  }

  removePoint(user: User): void {
    if (!this.isModerator || !this.lobby) return;
    this.lobbyService.removePoint(this.lobby.lobbyCode, user.socketId);
  }

  resetAllPoints(): void {
    if (!this.isModerator || !this.lobby) return;

    if (
      confirm('Sind Sie sicher, dass Sie alle Punkte zurücksetzen möchten?')
    ) {
      this.lobbyService.resetAllPoints(this.lobby.lobbyCode);
    }
  }

  private updateUserPoints(updatedUser: User): void {
    if (!this.lobby) return;

    // Force refresh to ensure UI is updated
    this.cdr.detectChanges();
  }

  // New methods for avatar handling
  getInitial(username: string): string {
    return username && username.length > 0
      ? username.charAt(0).toUpperCase()
      : '?';
  }

  getAvatarUrl(user: User | undefined): string | null {
    if (!user) return null;
    return this.userAvatars.get(user.username) || null;
  }

  private loadAllUserAvatars(): void {
    // Safely guard against attempting to load avatars with no lobby data
    if (!this.lobby || !this.lobby.lobbyCode) {
      // console.log('loadAllUserAvatars: No lobby data available yet');
      return;
    }

    if (this.avatarsLoading) {
      // console.log('Avatar loading already in progress, skipping');
      return;
    }

    // console.log(
    //   'Starting avatar loading process for lobby:',
    //   this.lobby.lobbyCode
    // );
    this.avatarsLoading = true;

    // Load moderator avatar
    if (this.lobby.moderator) {
      this.loadUserAvatar(this.lobby.moderator.username);
    } else {
      // console.log('No moderator found in lobby');
    }

    // Load avatars for all other users
    if (this.lobby.users && this.lobby.users.length > 0) {
      // console.log(`Loading avatars for ${this.lobby.users.length} users`);
      this.lobby.users.forEach((user) => {
        this.loadUserAvatar(user.username);
      });
    } else {
      // console.log('No users found in lobby');
    }

    this.avatarsLoading = false;
  }

  private loadUserAvatar(username: string): void {
    // Skip if we already have this avatar
    if (!username) {
      // console.log('Cannot load avatar for empty username');
      return;
    }

    if (this.userAvatars.has(username)) {
      // console.log(`Already have avatar for ${username}, skipping load`);
      return;
    }

    // console.log(`Loading avatar for ${username}`);

    this.lobbyService.getUserAvatar(username).subscribe({
      next: (response) => {
        if (response && response.avatarUrl) {
          // console.log(`Avatar received for ${username}:`, response.avatarUrl);
          this.userAvatars.set(username, response.avatarUrl);
          this.cdr.detectChanges(); // Update the view
        } else {
          // console.log(`Empty avatar URL received for ${username}`);
          this.userAvatars.set(username, ''); // Store empty string to avoid retries
        }
      },
      error: (error) => {
        // console.log(`Error loading avatar for ${username}:`, error);
        // Set empty string to avoid loading attempts for the same user again
        this.userAvatars.set(username, '');
      },
    });
  }
}
