import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private static socket: Socket;

  constructor() {
    if (!SocketService.socket) {
      // Hier die URL deines Socket.io-Servers eintragen
      var token = localStorage.getItem('jwt_token');
      if (token) {
        SocketService.socket = io('http://localhost:3000', {
          auth: {
            token: localStorage.getItem('jwt_token'),
          },
        });
      } else {
        SocketService.socket = io('http://localhost:3000');
      }
    }
  }

  getSocket(): Socket {
    return SocketService.socket;
  }
}
