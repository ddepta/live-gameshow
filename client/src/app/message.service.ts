import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { SocketService } from './socket.service';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  public message$: BehaviorSubject<string> = new BehaviorSubject('');
  public buzz$: BehaviorSubject<string> = new BehaviorSubject('');

  private socket!: Socket;

  constructor(private socketService: SocketService) {
    this.socket = this.socketService.getSocket();
  }
  public sendMessage(message: any) {
    console.log('sendMessage: ', message);
    this.socket.emit('message', message);
  }
  public getNewMessage = () => {
    this.socket.on('message', (message) => {
      this.message$.next(message);
    });

    return this.message$.asObservable();
  };
}
