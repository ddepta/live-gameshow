export interface Event {
  action: string;
  socketId: string;
  username: string;
  data?: any;
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
  currentBuzzerState?: Event;
  eventHistory?: Event[];
}
