import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { SocketService } from '../socket.service';

@Injectable({
  providedIn: 'root',
})
export class LobbyService {
  joinLobbySubject = new Subject<any>();
  lobbySubject = new Subject<any>();
  lobbyJoinSubect = new Subject<any>();

  private socket!: Socket;

  constructor(private socketService: SocketService) {
    this.socket = this.socketService.getSocket();
  }

  public joinLobby(username: string, lobbyCode?: string) {
    let result: any;
    this.socket.emit('lobby:join', lobbyCode, username, (response: any) => {
      this.joinLobbySubject.next(response);
    });
    return this.joinLobbySubject;
  }

  public getLobby(lobbyCode: string) {
    let result: any;
    this.socket.emit('lobby:get', lobbyCode, (response: any) => {
      this.lobbySubject.next(response);
    });
    return this.lobbySubject;
  }

  public getLobbyJoins = () => {
    this.socket.on('lobby:joined', (message) => {
      this.lobbyJoinSubect.next(message);
    });
    return this.lobbyJoinSubect;
  };
}
