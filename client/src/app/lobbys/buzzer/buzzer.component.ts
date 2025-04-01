import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { style, trigger, transition, animate } from '@angular/animations';
import { BuzzerService } from '../buzzer.service';
import { MessageService } from '../../message.service';
import { CommonModule } from '@angular/common';

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
  // Remove this line as 'imports' is not valid here
  imports: [FormsModule, CommonModule],
})
export class BuzzerComponent {
  activeBuzzer = false;
  buzzerName = '';

  @Input() lobbyCode!: string;

  constructor(private buzzerService: BuzzerService) {}

  ngOnInit() {
    this.buzzerService.getBuzzer().subscribe((message: string) => {
      this.getBuzzerAlert(message);
    });
    this.buzzerService.getBuzzerReset().subscribe((message: string) => {
      this.getBuzzerReset(message);
    });
  }

  getBuzzerAlert(message: string) {
    this.buzzerName = message;
    this.activeBuzzer = true;
  }

  getBuzzerReset(message: string) {
    this.buzzerName = '';
    this.activeBuzzer = false;
  }

  buzzer() {
    this.buzzerService.buzzer(this.lobbyCode);
  }

  buzzerReset() {
    this.buzzerService.buzzerReset(this.lobbyCode);
  }
}
