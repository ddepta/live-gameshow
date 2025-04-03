import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { Router } from '@angular/router';
import { SocketService } from '../socket.service';
import {
  Lobby,
  User,
  BuzzerState,
  EventHistory,
  JoinLobbyResponse,
} from '../types';

@Injectable({
  providedIn: 'root',
})
export class LobbyService {
  joinLobbySubject = new Subject<any>();
  lobbySubject = new Subject<Lobby>();
  lobbyJoinSubect = new Subject<any>();
  lobbyKickedSubject = new Subject<any>();

  private socket!: Socket;

  constructor(private socketService: SocketService, private router: Router) {
    this.socket = this.socketService.getSocket();

    // Listen for kicked event
    this.socket.on('lobby:kicked', (data) => {
      this.lobbyKickedSubject.next(data);
      // Redirect to home when kicked
      this.router.navigate(['/']);
    });
  }

  public joinLobby(username: string, lobbyCode?: string) {
    this.socket.emit(
      'lobby:join',
      lobbyCode,
      username,
      (response: JoinLobbyResponse) => {
        this.joinLobbySubject.next(response);
      }
    );
    return this.joinLobbySubject;
  }

  public getLobby(lobbyCode: string) {
    this.socket.emit('lobby:get', lobbyCode, (response: Lobby) => {
      this.lobbySubject.next(response);
    });
    return this.lobbySubject;
  }

  public getLobbyJoins = () => {
    console.log('lobby joinded');
    this.socket.on('lobby:joined', (message) => {
      this.lobbyJoinSubect.next(message);
    });
    return this.lobbyJoinSubect;
  };

  public kickUser(lobbyCode: string, userSocketId: string) {
    this.socket.emit('lobby:kick', lobbyCode, userSocketId);
  }

  public getKickNotifications(): Observable<any> {
    return this.lobbyKickedSubject.asObservable();
  }
}
