import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { SocketService } from '../socket.service';

@Injectable({
  providedIn: 'root',
})
export class BuzzerService {
  buzzerSubject = new Subject<any>();
  buzzerResetSubject = new Subject<any>();
  buzzerLockedSubject = new Subject<any>();
  private socket!: Socket;

  constructor(private socketService: SocketService) {
    this.socket = this.socketService.getSocket();
  }

  public buzzer(lobbyCode: string) {
    this.socket.emit('buzzer:pressed', lobbyCode);
  }

  public buzzerReset(lobbyCode: string) {
    this.socket.emit('buzzer:reset', lobbyCode);
  }

  public buzzerLock(lobbyCode: string) {
    this.socket.emit('buzzer:locked', lobbyCode);
  }

  public getBuzzer = () => {
    this.socket.on('buzzer:pressed', (message) => {
      // console.log('buzzer:pressed: ', message);
      this.buzzerSubject.next(message);
    });
    return this.buzzerSubject;
  };

  public getBuzzerReset = () => {
    this.socket.on('buzzer:reset', (message) => {
      this.buzzerResetSubject.next(message);
    });
    return this.buzzerResetSubject;
  };

  public getBuzzerLocked = () => {
    this.socket.on('buzzer:locked', (message) => {
      this.buzzerLockedSubject.next(message);
    });
    return this.buzzerLockedSubject;
  };
}
