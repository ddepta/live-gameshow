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
  points?: number; // Add points property
}

// moderator, users, if active, points, buzzer history
export interface Lobby {
  error: any;
  lobbyCode: string;
  moderator: User;
  users?: User[];
  isActive: boolean;
  currentBuzzerState?: BuzzerState;
  eventHistory?: EventHistory[];
  isModerator?: boolean;
  gameState?: GameState; // Add game state to the lobby interface
}

export interface JoinLobbyResponse {
  lobbyCode: string;
  token: string;
  username: string;
  error?: string;
}

// New interface for the user list updates
export interface UserListUpdate {
  lobbyCode: string;
  users: User[];
  moderator: User;
}

export interface GameState {
  isGameActive: boolean;
  currentQuestionIndex: number;
  isQuestionVisible: boolean;
  isAnswerVisible: boolean;
}
