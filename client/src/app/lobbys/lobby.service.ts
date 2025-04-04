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
  UserListUpdate,
} from '../types';

@Injectable({
  providedIn: 'root',
})
export class LobbyService {
  joinLobbySubject = new Subject<any>();
  lobbySubject = new Subject<Lobby>();
  lobbyJoinSubect = new Subject<any>();
  lobbyKickedSubject = new Subject<any>();
  userListSubject = new Subject<string>(); // Subject for user list updates
  private currentLobby: Lobby | null = null; // Store current lobby data

  private socket!: Socket;

  constructor(private socketService: SocketService, private router: Router) {
    this.socket = this.socketService.getSocket();

    // Listen for kicked event
    this.socket.on('lobby:kicked', (data) => {
      this.lobbyKickedSubject.next(data);
      // Redirect to home when kicked
      this.router.navigate(['/']);
    });

    // Listen for user list updates
    this.socket.on('lobby:userList', (update: UserListUpdate) => {
      console.log('User list updated:', update);

      // Update the current lobby if it matches
      if (
        this.currentLobby &&
        this.currentLobby.lobbyCode === update.lobbyCode
      ) {
        this.currentLobby.users = update.users;
        this.currentLobby.moderator = update.moderator;

        // Notify subscribers that the user list has changed
        this.userListSubject.next(update.lobbyCode);
      }
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
      if (!response.error) {
        this.currentLobby = response; // Store the lobby data
      }
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

  // New method to get user list updates
  public getLobbyUpdates(): Observable<string> {
    return this.userListSubject.asObservable();
  }

  // Method to get the current lobby data
  public getCurrentLobby(): Lobby | null {
    return this.currentLobby;
  }
}
