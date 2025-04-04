import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, GameData, Question } from '../game.service';
import { LobbyService } from '../lobbys/lobby.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  providers: [GameService],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit {
  lobbyCode: string = '';
  gameData: GameData | null = null;
  currentQuestionIndex: number = 0;

  get currentQuestion(): Question | undefined {
    return this.gameData?.questions[this.currentQuestionIndex];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private lobbyService: LobbyService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.lobbyCode = params['lobbyCode'];

      // Get the game data from the service - this should now work with the direct import
      this.gameData = this.gameService.getGameData();
      console.log('Game data in game component:', this.gameData);

      // If still no data, try loading it (though it should be available now)
      if (!this.gameData) {
        this.gameService.loadGameData().subscribe({
          next: (gameFile) => {
            this.gameData = gameFile.gameData;
          },
          error: (err) => {
            console.error('Error loading game data:', err);
            // Redirect back to lobby on error
            this.router.navigate(['/lobby', this.lobbyCode]);
          },
        });
      }
    });
  }

  nextQuestion(): void {
    if (
      this.gameData &&
      this.currentQuestionIndex < this.gameData.questions.length - 1
    ) {
      this.currentQuestionIndex++;
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  backToLobby(): void {
    this.router.navigate(['/lobby', this.lobbyCode]);
  }
}
