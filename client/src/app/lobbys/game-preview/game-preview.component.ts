import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, GameData } from '../../game.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-game-preview',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  providers: [GameService], // Add GameService to providers
  templateUrl: './game-preview.component.html',
  styleUrl: './game-preview.component.scss',
})
export class GamePreviewComponent implements OnInit {
  gameData: GameData | null = null;
  isLoading: boolean = true;
  errorLoading: boolean = false;

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.loadGameData();

    // Subscribe to any future game data changes
    this.gameService.gameData$.subscribe((data) => {
      if (data) {
        this.gameData = data;
      }
    });
  }

  loadGameData(): void {
    this.isLoading = true;
    this.errorLoading = false;

    // First check if data is already loaded in service
    const existingData = this.gameService.getGameData();
    if (existingData) {
      this.gameData = existingData;
      this.isLoading = false;
      return;
    }

    // Otherwise load it
    this.gameService.loadGameData().subscribe({
      next: (gameFile) => {
        this.gameData = gameFile.gameData;
        console.log('Game data loaded in GamePreviewComponent:', this.gameData);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading game data:', err);
        this.errorLoading = true;
        this.isLoading = false;
      },
    });
  }
}
