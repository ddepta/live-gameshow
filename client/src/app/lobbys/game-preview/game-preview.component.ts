import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, GameData } from '../../game.service';
import { HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game-preview',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  // Remove GameService from providers so it uses the parent's instance
  templateUrl: './game-preview.component.html',
  styleUrl: './game-preview.component.scss',
})
export class GamePreviewComponent implements OnInit, OnDestroy {
  gameData: GameData | null = null;
  isLoading: boolean = true;
  errorLoading: boolean = false;
  showDemoQuestions: boolean = false;
  private subscriptions: Subscription[] = [];

  // Placeholder content
  placeholderTitle: string = 'SPIEL LADEN';
  placeholderDescription: string =
    'Du kannst entweder ein Spiel hochladen oder das Demo-Spiel laden.';
  placeholderQuestionCount: number = 0;

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.loadGameData();

    // Subscribe to any future game data changes
    this.subscriptions.push(
      this.gameService.gameData$.subscribe((data) => {
        if (data) {
          this.gameData = data;
          this.placeholderQuestionCount = data.questions.length;
        }
      })
    );

    // Subscribe to demo questions visibility state
    this.subscriptions.push(
      this.gameService.showDemoQuestions$.subscribe((show) => {
        this.showDemoQuestions = show;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  loadGameData(): void {
    this.isLoading = true;
    this.errorLoading = false;

    // First check if data is already loaded in service
    const existingData = this.gameService.getGameData();
    if (existingData) {
      this.gameData = existingData;
      this.placeholderQuestionCount = existingData.questions.length;
      this.isLoading = false;
      return;
    }

    // Otherwise load it
    this.gameService.loadGameData().subscribe({
      next: (gameFile) => {
        this.gameData = gameFile.gameData;
        this.placeholderQuestionCount = gameFile.gameData.questions.length;
        // console.log('Game data loaded in GamePreviewComponent:', this.gameData);
        this.isLoading = false;
      },
      error: (err) => {
        // console.error('Error loading game data:', err);
        this.errorLoading = true;
        this.isLoading = false;
      },
    });
  }
}
