import { Component, Input } from '@angular/core';
import { Event } from '../../../types';

@Component({
  selector: 'app-buzzer-event',
  templateUrl: './buzzer-event.component.html',
  styleUrls: ['./buzzer-event.component.scss'],
})
export class BuzzerEventComponent {
  @Input() event!: Event;
}
