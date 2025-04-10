import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { LobbyService } from '../lobby.service';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { typPlus, typPlusOutline, typUpload } from '@ng-icons/typicons';
import { gameRetroController } from '@ng-icons/game-icons';
import { HttpClientModule } from '@angular/common/http';
import { NgIf } from '@angular/common';
import { phosphorUserCircleDashedDuotone } from '@ng-icons/phosphor-icons/duotone';
import { SocketService } from '../../socket.service';
import { Subscription, filter, take, tap } from 'rxjs';

@Component({
  selector: 'app-join-lobby',
  templateUrl: './join-lobby.component.html',
  styleUrls: ['./join-lobby.component.scss'],
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    NgIcon,
    HttpClientModule,
    NgIf,
  ],
  providers: [
    provideIcons({
      typPlus,
      typPlusOutline,
      gameRetroController,
      typUpload,
      phosphorUserCircleDashedDuotone,
    }),
  ],
})
export class JoinLobbyComponent implements OnInit, OnDestroy {
  lobbyCode!: string;
  username!: string;
  avatarUrl: string | null = null;
  isAvatarLoading = false;
  isAvatarLoaded = false; // New property to track if avatar is fully loaded
  private connectionSubscription: Subscription | null = null;
  private avatarLoadAttempts = 0;
  private maxAttempts = 3;
  private pendingAvatarUrl: string | null = null; // Store URL of image being preloaded

  @ViewChild('usernameInput') usernameInput!: ElementRef;
  @ViewChild('lobbyCodeInput') lobbyCodeInput!: ElementRef;

  constructor(
    private lobbyService: LobbyService,
    private router: Router,
    private socketService: SocketService,
    private route: ActivatedRoute // Add ActivatedRoute
  ) {}

  ngOnInit() {
    this.username = localStorage.getItem('username') || '';

    // Check for lobbyCode in query parameters
    this.route.queryParams.subscribe((params) => {
      if (params['lobbyCode']) {
        this.lobbyCode = params['lobbyCode'];
      }
    });

    // If we have a username, try to load the avatar after connection
    if (this.username) {
      // Handle avatar loading based on connection status
      this.connectionSubscription = this.socketService
        .getConnectionStatus()
        .pipe(
          // Only trigger when connection is true
          filter((connected) => connected),
          // Only take the first true value
          take(1),
          tap(() => {
            // console.log('Socket connected, loading avatar asynchronously');
            this.loadUserAvatar();
          })
        )
        .subscribe();
    }
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }

    // Clean up any object URLs to prevent memory leaks
    if (this.avatarUrl && this.avatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.avatarUrl);
    }
    if (this.pendingAvatarUrl && this.pendingAvatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.pendingAvatarUrl);
    }
  }

  /**
   * Preloads an image and only sets it as the avatar once fully loaded
   * @param url The URL of the image to preload
   */
  preloadAvatar(url: string): void {
    if (!url) return;

    this.isAvatarLoading = true;
    this.pendingAvatarUrl = url;
    this.isAvatarLoaded = false;

    this.lobbyService
      .preloadAvatar(url)
      .then(() => {
        // console.log('Avatar preloaded successfully:', url);
        // Only set the avatar URL after it's fully loaded
        this.avatarUrl = this.pendingAvatarUrl;
        this.isAvatarLoaded = true;
        this.isAvatarLoading = false;
        this.pendingAvatarUrl = null;
      })
      .catch((error) => {
        // console.error('Failed to preload avatar:', error);
        this.isAvatarLoading = false;
        this.pendingAvatarUrl = null;
      });
  }

  loadUserAvatar() {
    if (this.avatarLoadAttempts >= this.maxAttempts || this.isAvatarLoading) {
      return;
    }

    this.isAvatarLoading = true;
    this.avatarLoadAttempts++;

    this.lobbyService.getUserAvatar(this.username).subscribe({
      next: (response) => {
        if (response && response.avatarUrl) {
          // console.log('Avatar URL received:', response.avatarUrl);
          // Preload the image instead of setting it directly
          this.preloadAvatar(response.avatarUrl);
        } else {
          this.isAvatarLoading = false;
        }
      },
      error: (error) => {
        // console.error('Error loading avatar:', error);
        this.isAvatarLoading = false;

        // Retry if needed
        if (this.avatarLoadAttempts < this.maxAttempts) {
          // console.log(`Retrying avatar load automatically`);
          this.loadUserAvatar();
        }
      },
    });
  }

  joinLobby() {
    // Validate both inputs
    let isValid = true;
    // console.log('joinlobby');

    // Check username
    if (!this.username || this.username.trim() === '') {
      this.triggerShakeAnimation(this.usernameInput?.nativeElement);
      isValid = false;
    }

    // Check lobby code
    if (!this.lobbyCode || this.lobbyCode.trim() === '') {
      this.triggerShakeAnimation(this.lobbyCodeInput?.nativeElement);
      isValid = false;
    }

    // Only proceed if both fields are valid
    if (isValid) {
      this.lobbyService
        .joinLobby(this.username, this.lobbyCode)
        .subscribe((result: any) => {
          // console.log('join lobby result: ', result);
          if (!result.error) {
            // console.log('no error: ', result);
            localStorage.setItem('jwt_token', result.token);
            localStorage.setItem('username', result.username);
            this.router.navigate(['/lobby', result.lobbyCode]);
          } else {
            this.triggerShakeAnimation(this.lobbyCodeInput?.nativeElement);
          }
        });
    }
  }

  // Helper method to manually trigger shake animation
  triggerShakeAnimation(element: HTMLElement) {
    if (element) {
      // Force the input to be validated
      element.classList.remove('ng-valid');
      element.classList.add('ng-invalid');

      // Remove and re-add animation to trigger it again if already animating
      element.style.animation = 'none';
      setTimeout(() => {
        element.style.animation = '';
      }, 10);
    }
  }

  createLobby() {
    // Only validate the username for lobby creation
    if (!this.username || this.username.trim() === '') {
      this.triggerShakeAnimation(this.usernameInput?.nativeElement);
      return;
    }

    this.lobbyService.joinLobby(this.username).subscribe((result: any) => {
      // console.log('createlobby result: ', result);
      if (!result.error) {
        localStorage.setItem('jwt_token', result.token);
        localStorage.setItem('username', result.username);
        this.router.navigate(['/lobby', result.lobbyCode]);
      }
    });
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    // console.log('Selected file:', file);
    if (file) {
      // Show loading state
      this.isAvatarLoading = true;

      // Create an object URL for the file
      const tempUrl = URL.createObjectURL(file);

      // Preload the image first
      this.preloadAvatar(tempUrl);

      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('username', this.username);

      this.lobbyService.uploadAvatar(formData).subscribe({
        next: (response) => {
          // console.log('Avatar uploaded successfully:', response);
          if (response && response.avatarUrl) {
            // If server URL is different, preload again with the server URL
            if (response.avatarUrl !== this.avatarUrl) {
              // Clean up the previous object URL to avoid memory leaks
              if (this.avatarUrl && this.avatarUrl.startsWith('blob:')) {
                URL.revokeObjectURL(this.avatarUrl);
              }

              // Preload the server URL
              this.preloadAvatar(response.avatarUrl);
            }
          }
        },
        error: (error) => {
          // console.error('Error uploading avatar:', error);
          this.isAvatarLoading = false;
        },
      });
    }
  }
}
