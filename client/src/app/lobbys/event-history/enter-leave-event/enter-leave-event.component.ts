import { Component, Input, OnInit } from '@angular/core';
import { Event } from '../../../types';

@Component({
  selector: 'app-enter-leave-event',
  templateUrl: './enter-leave-event.component.html',
  styleUrls: ['./enter-leave-event.component.scss'],
})
export class EnterLeaveEventComponent implements OnInit {
  @Input() event!: Event;
  output = '';

  ngOnInit(): void {
    var role = this.event.action.split(':')[1];
    var action = this.event.action.split(':')[2];
    if (role === 'moderator') {
      this.output = 'Moderator ';
    }

    this.output += this.event.username + ' hat die Lobby ';

    if (action === 'joined') {
      this.output += 'betreten';
    } else {
      this.output += 'verlassen';
    }
  }
}
