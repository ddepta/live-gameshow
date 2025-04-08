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
  evaluation?: BuzzerEvaluation; // Add evaluation property
}

// New interface for buzzer answer evaluation
export interface BuzzerEvaluation {
  isCorrect: boolean | null;
  evaluatedAt: number | null;
  finalized: boolean;
}

// New interface for the buzzer round finalization event
export interface BuzzerRoundFinalized {
  username: string;
  isCorrect: boolean;
  pointsAwarded: number;
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

// Add these new interfaces
export interface SubmittedAnswer {
  id?: string; // Add optional ID field
  username: string;
  questionIndex: number;
  answer: string;
  type: 'multipleChoice' | 'estimation';
  timestamp: number;
  socketId?: string; // Add optional socketId for user identification
}

export interface AnswerUpdate {
  lobbyCode: string;
  answers: SubmittedAnswer[];
  currentQuestionAnswers?: SubmittedAnswer[]; // Add for question-specific answers
  questionIndex?: number; // Add question index from the update
  currentQuestionState?: {
    index: number;
    total: number;
    usernames: string[];
  };
}
