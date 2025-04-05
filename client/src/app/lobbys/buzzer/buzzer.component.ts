import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { style, trigger, transition, animate } from '@angular/animations';
import { BuzzerService } from '../buzzer.service';
import { MessageService } from '../../message.service';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorLockLaminatedFill } from '@ng-icons/phosphor-icons/fill';

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
  imports: [FormsModule, CommonModule, NgIcon],
  providers: [provideIcons({ phosphorLockLaminatedFill })],
})
export class BuzzerComponent {
  activeBuzzer = false;
  buzzerLocked = false;
  buzzerName = '';

  @Input() lobbyCode!: string;
  @Input() isModerator?: boolean;
  @Input() size: 'small' | 'large' = 'small'; // Default to small size

  constructor(private buzzerService: BuzzerService) {}

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

  getBuzzerAlert(message: string) {
    this.buzzerName = message;
    this.activeBuzzer = true;
  }

  getBuzzerReset(message: string) {
    this.buzzerName = '';
    this.activeBuzzer = false;
    this.buzzerLocked = false;
  }

  getBuzzerLocked(message: string) {
    this.buzzerLocked = true;
    this.activeBuzzer = false;
    this.buzzerName = '';
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
}
