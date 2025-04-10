import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private static socket: Socket;
  private static httpClient: HttpClient;
  // private serverUrl = 'https://live-gameshow.onrender.com'; // Replace with your server URL

  private serverUrl = 'http://localhost:3000'; // Replace with your server URL
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  constructor(httpClient: HttpClient) {
    if (!SocketService.socket) {
      this.initializeSocket();
    }
    if (!SocketService.httpClient) {
      SocketService.httpClient = httpClient;
    }
  }

  private initializeSocket(): void {
    const token = localStorage.getItem('jwt_token');

    // Create socket with auth token if available
    SocketService.socket = io(this.serverUrl, {
      auth: {
        token: token || undefined,
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Handle reconnection attempts
    SocketService.socket.on('reconnect_attempt', () => {
      // console.log('Socket reconnecting - updating token');
      const currentToken = localStorage.getItem('jwt_token');
      SocketService.socket.auth = { token: currentToken || undefined };
    });

    // Log connection events for debugging
    SocketService.socket.on('connect', () => {
      // console.log('Socket connected successfully');
      this.connectionStatusSubject.next(true);
    });

    SocketService.socket.on('disconnect', () => {
      // console.log('Socket disconnected');
      this.connectionStatusSubject.next(false);
    });

    SocketService.socket.on('connect_error', (error) => {
      // console.error('Socket connection error:', error);
      this.connectionStatusSubject.next(false);
    });
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  getSocket(): Socket {
    return SocketService.socket;
  }

  getHttpClient(): HttpClient {
    return SocketService.httpClient;
  }

  // Returns an observable that emits true when connected, false when disconnected
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  // Method to check if socket is currently connected
  isConnected(): boolean {
    return SocketService.socket?.connected || false;
  }

  // Method to update token when it changes
  updateToken(token: string | null): void {
    if (SocketService.socket) {
      SocketService.socket.auth = { token: token || undefined };
      // console.log('Socket auth token updated');
    }
  }

  // Disconnect socket on application shutdown or logout
  disconnect(): void {
    if (SocketService.socket) {
      SocketService.socket.disconnect();
      // console.log('Socket disconnected');
    }
  }
}
