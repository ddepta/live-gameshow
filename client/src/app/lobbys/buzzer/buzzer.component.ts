import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { style, trigger, transition, animate } from '@angular/animations';
import { BuzzerService } from '../buzzer.service';
import { MessageService } from '../../message.service';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorLockLaminatedFill } from '@ng-icons/phosphor-icons/fill';
import { LobbyService } from '../lobby.service';

const enterTransition = transition(':enter', [
  style({ opacity: 0 }),
  animate('1s ease-in', style({ opacity: 1 })),
  animate('1s ease-out', style({ opacity: 0 })),
]);
const fadeIn = trigger('fadeIn', [enterTransition]);

const exitTransition = transition(':leave', [style({ opacity: 1 })]);
const fadeOut = trigger('fadeOut', [exitTransition]);

@Component({
  selector: 'app-buzzer',
  templateUrl: './buzzer.component.html',
  styleUrls: ['./buzzer.component.scss'],
  animations: [fadeIn, fadeOut],
  imports: [FormsModule, CommonModule, NgIcon],
  providers: [provideIcons({ phosphorLockLaminatedFill })],
})
export class BuzzerComponent implements OnInit {
  activeBuzzer = false;
  buzzerLocked = false;
  buzzerName = '';
  avatarUrl: string | null = null;
  isAvatarLoading = false;

  @Input() lobbyCode!: string;
  @Input() isModerator?: boolean;
  @Input() size: 'small' | 'large' = 'small'; // Default to small size

  constructor(
    private buzzerService: BuzzerService,
    private lobbyService: LobbyService
  ) {}

  ngOnInit() {
    this.buzzerService.getBuzzer().subscribe((message: string) => {
      this.getBuzzerAlert(message);
    });

    this.buzzerService.getBuzzerReset().subscribe((message: string) => {
      this.getBuzzerReset(message);
    });

    this.buzzerService.getBuzzerLocked().subscribe((message: string) => {
      this.getBuzzerLocked(message);
    });
  }

  getBuzzerAlert(username: string) {
    this.buzzerName = username;
    this.activeBuzzer = true;

    // Load avatar when buzzer is pressed
    this.loadAvatar(username);
  }

  getBuzzerReset(message: string) {
    this.buzzerName = '';
    this.activeBuzzer = false;
    this.buzzerLocked = false;
    this.avatarUrl = null;
  }

  getBuzzerLocked(message: string) {
    this.buzzerLocked = true;
    this.activeBuzzer = false;
    this.buzzerName = '';
    this.avatarUrl = null;
  }

  buzzer() {
    if (!this.buzzerLocked) {
      this.buzzerService.buzzer(this.lobbyCode);
    }
  }

  toggleBuzzer() {
    if (this.buzzerLocked || this.activeBuzzer) {
      this.buzzerService.buzzerReset(this.lobbyCode);
    } else {
      this.buzzerService.buzzerLock(this.lobbyCode);
    }
  }

  // Get the first letter of username for avatar fallback
  getInitial(username: string): string {
    return username && username.length > 0
      ? username.charAt(0).toUpperCase()
      : '?';
  }

  // Load avatar for the user who pressed the buzzer
  private loadAvatar(username: string): void {
    if (!username) return;

    this.isAvatarLoading = true;

    this.lobbyService.getUserAvatar(username).subscribe({
      next: (response) => {
        if (response && response.avatarUrl) {
          // console.log('Avatar loaded for buzzer user:', response.avatarUrl);
          this.avatarUrl = response.avatarUrl;
        }
        this.isAvatarLoading = false;
      },
      error: (error) => {
        // console.error('Error loading buzzer avatar:', error);
        this.isAvatarLoading = false;
      },
    });
  }
}
