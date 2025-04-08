import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private static socket: Socket;
  // private serverUrl = 'http://localhost:3000';
  private serverUrl = 'https://live-gameshow.onrender.com'; // Replace with your server URL

  constructor() {
    if (!SocketService.socket) {
      this.initializeSocket();
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
      console.log('Socket reconnecting - updating token');
      const currentToken = localStorage.getItem('jwt_token');
      SocketService.socket.auth = { token: currentToken || undefined };
    });

    // Log connection events for debugging
    SocketService.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    SocketService.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  getSocket(): Socket {
    return SocketService.socket;
  }

  // Method to update token when it changes
  updateToken(token: string | null): void {
    if (SocketService.socket) {
      SocketService.socket.auth = { token: token || undefined };
      console.log('Socket auth token updated');
    }
  }

  // Disconnect socket on application shutdown or logout
  disconnect(): void {
    if (SocketService.socket) {
      SocketService.socket.disconnect();
      console.log('Socket disconnected');
    }
  }
}
