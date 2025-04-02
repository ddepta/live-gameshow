export interface EventHistory {
  action: string;
  socketId: string;
  username: string;
  data?: any;
}

export interface BuzzerState {
  action: string;
  socketId: string;
  username: string;
  data: string;
}

export interface User {
  socketId: string;
  username: string;
}

// moderator, users, if active, points, buzzer history
export interface Lobby {
  lobbyCode: string;
  moderator: User;
  users?: User[];
  isActive: boolean;
  currentBuzzerState?: BuzzerState;
  eventHistory?: EventHistory[];
  isModerator?: boolean;
}

export interface JoinLobbyResponse {
  lobbyCode: string;
  token: string;
  username: string;
  error?: string;
}
