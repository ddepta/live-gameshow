import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LobbyService } from '../../lobbys/lobby.service';
import { User } from '../../types';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.scss'],
})
export class ResultComponent implements OnInit, OnDestroy, OnChanges {
  @Input() lobbyCode: string | undefined;

  users: User[] = [];
  moderator: User | null = null;
  sortedResults: { username: string; points: number; isModerator: boolean }[] =
    [];
  private subscriptions: Subscription[] = [];

  constructor(private lobbyService: LobbyService) {}

  ngOnInit(): void {
    this.loadResultsData();

    // Subscribe to point updates
    this.subscriptions.push(
      this.lobbyService.onPointUpdated().subscribe((updatedUser) => {
        // console.log('Point update received in results component:', updatedUser);
        this.updateUserInResults(updatedUser);
      })
    );

    // Subscribe to point reset events
    this.subscriptions.push(
      this.lobbyService.onAllPointsReset().subscribe((users) => {
        // console.log('All points reset in results component');
        this.loadResultsData(); // Reload all data when points are reset
      })
    );

    // Subscribe to lobby updates (new users, user leaves, etc.)
    this.subscriptions.push(
      this.lobbyService.getLobbyUpdates().subscribe((lobbyCode) => {
        if (lobbyCode === this.lobbyCode) {
          // console.log('Lobby updated, refreshing results data');
          this.loadResultsData();
        }
      })
    );
  }

  // Add OnChanges lifecycle hook to respond to input changes
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lobbyCode'] && !changes['lobbyCode'].firstChange) {
      // console.log('Lobby code changed, reloading results data');
      this.loadResultsData();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Load or reload all results data from the current lobby state
   */
  private loadResultsData(): void {
    const lobby = this.lobbyService.getCurrentLobby();
    if (lobby) {
      // console.log('Loading results data for lobby:', lobby.lobbyCode);

      // Get all users with their points
      this.users = lobby.users || [];
      this.moderator = lobby.moderator;

      // Create combined sorted results - but exclude the moderator
      this.sortedResults = [];

      // Add users to results
      this.users.forEach((user) => {
        this.sortedResults.push({
          username: user.username,
          points: user.points || 0,
          isModerator: false,
        });
      });

      // Remove moderator from results - don't add them in the first place
      // Removed the code that adds the moderator

      // Sort by points (highest first)
      this.sortResults();

      // console.log('Results data loaded:', this.sortedResults);
    } else {
      // console.warn('No lobby data available');
      this.sortedResults = [];
    }
  }

  /**
   * Update a single user's points in the results list
   */
  private updateUserInResults(updatedUser: User): void {
    // Skip if this is the moderator
    if (this.moderator && this.moderator.username === updatedUser.username) {
      // console.log(
      //   `Skipping moderator ${updatedUser.username} in results update`
      // );
      return;
    }

    // Find and update the user in our results array
    const userIndex = this.sortedResults.findIndex(
      (result) => result.username === updatedUser.username
    );

    if (userIndex !== -1) {
      // Update points for the existing user
      this.sortedResults[userIndex].points = updatedUser.points || 0;
      // console.log(
      //   `Updated points for ${updatedUser.username} to ${updatedUser.points}`
      // );
    } else {
      // Only add if not moderator
      if (!this.moderator || this.moderator.username !== updatedUser.username) {
        this.sortedResults.push({
          username: updatedUser.username,
          points: updatedUser.points || 0,
          isModerator: false, // Never mark as moderator
        });
        // console.log(
        //   `Added new user ${updatedUser.username} with ${updatedUser.points} points`
        // );
      }
    }

    // Re-sort the results after update
    this.sortResults();
  }

  /**
   * Sort results by points in descending order
   */
  private sortResults(): void {
    this.sortedResults.sort((a, b) => b.points - a.points);
  }
}
