import { Component, Input, OnInit } from '@angular/core';
import { LobbyService } from '../lobby.service';
import { Lobby, Event } from '../../types';
import { BuzzerEventComponent } from './buzzer-event/buzzer-event.component';
import { EnterLeaveEventComponent } from './enter-leave-event/enter-leave-event.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-event-history',
  templateUrl: './event-history.component.html',
  styleUrls: ['./event-history.component.scss'],
  imports: [BuzzerEventComponent, EnterLeaveEventComponent, CommonModule],
})
export class EventHistoryComponent implements OnInit {
  @Input() eventHistory: Event[] = [];

  constructor(private lobbyService: LobbyService) {}

  ngOnInit(): void {
    // this.eventHistory.push({
    //   action: 'lobby:moderator:joined',
    //   socketId: 'test',
    //   username: 'moderator',
    //   data: 'test',
    // });
    // this.eventHistory.push({
    //   action: 'lobby:user:joined',
    //   socketId: 'test',
    //   username: 'test',
    //   data: 'test',
    // });
    // this.eventHistory.push({
    //   action: 'buzzer:pressed',
    //   socketId: 'test',
    //   username: 'test',
    //   data: 'test',
    // });
    // this.eventHistory.push({
    //   action: 'buzzer:pressed',
    //   socketId: 'test',
    //   username: 'test',
    //   data: 'test',
    // });
    // this.eventHistory.push({
    //   action: 'lobby:user:left',
    //   socketId: 'test',
    //   username: 'test',
    //   data: 'test',
    // });
    // console.log('eventHistory: ', this.eventHistory);
  }
}
