import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import * as gameFile from '../assets/gamefiles/demo.json';

export interface Question {
  id: string;
  type: 'buzzer' | 'multipleChoice' | 'estimation';
  question: string;
  correctAnswer: string | number;
  options?: string[];
}

export interface GameData {
  title: string;
  description: string;
  questions: Question[];
}

export interface GameFile {
  gameData: GameData;
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private gameDataSubject = new BehaviorSubject<GameData | null>(null);
  public gameData$ = this.gameDataSubject.asObservable();

  private loadedGameFile: GameFile = gameFile as GameFile;

  constructor(private http: HttpClient) {
    // Initialize the subject with the game data from the imported file
    this.gameDataSubject.next(this.loadedGameFile.gameData);
  }

  /**
   * Load game data - now returns the already loaded data
   * Kept for backward compatibility with components
   */
  loadGameData(): Observable<GameFile> {
    console.log('Using directly imported game data');
    return of(this.loadedGameFile);
  }

  /**
   * Get the currently loaded game data
   */
  getGameData(): GameData | null {
    return this.loadedGameFile.gameData;
  }

  /**
   * Get questions from the loaded game
   */
  getQuestions(): Question[] {
    return this.loadedGameFile.gameData?.questions || [];
  }

  /**
   * Get a specific question by ID
   */
  getQuestion(id: string): Question | undefined {
    return this.loadedGameFile.gameData?.questions.find((q) => q.id === id);
  }
}
