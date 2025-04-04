import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Socket } from 'socket.io-client';
import { SocketService } from './socket.service';

export interface Message {
  text: string;
  username: string;
  isSelf: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MessageService implements OnDestroy {
  public message$: BehaviorSubject<Message> = new BehaviorSubject<Message>({
    text: '',
    username: '',
    isSelf: false,
  });
  public buzz$: BehaviorSubject<string> = new BehaviorSubject('');

  private socket!: Socket;
  private isListening = false;

  constructor(private socketService: SocketService) {
    this.socket = this.socketService.getSocket();

    // Register the message handler only once
    this.setupMessageListener();
  }

  ngOnDestroy() {
    // Clean up by removing the listener when service is destroyed
    this.cleanupMessageListener();
  }

  private setupMessageListener() {
    if (!this.isListening) {
      console.log('Setting up message listener');
      this.socket.on('message', (message: any) => {
        console.log('Received message:', message);

        // Handle both new object format and legacy string format
        if (typeof message === 'object' && message !== null) {
          // New format with separate username
          const username = localStorage.getItem('username') || '';
          const isSelf = message.username === username;

          this.message$.next({
            text: message.text,
            username: message.username,
            isSelf: isSelf,
          });
        } else {
          // Legacy format (string)
          this.message$.next({
            text: message,
            username: '',
            isSelf: false,
          });
        }
      });
      this.isListening = true;
    }
  }

  private cleanupMessageListener() {
    if (this.isListening) {
      console.log('Removing message listener');
      this.socket.off('message');
      this.isListening = false;
    }
  }

  public sendMessage(message: string) {
    console.log('Sending message:', message);
    this.socket.emit('message', message);
  }

  public getNewMessage = (): Observable<Message> => {
    // No need to set up the listener again, just return the observable
    return this.message$.asObservable();
  };
}
