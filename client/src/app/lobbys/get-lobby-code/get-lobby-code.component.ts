import { Component } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-get-lobby-code',
  imports: [ButtonModule],
  templateUrl: './get-lobby-code.component.html',
  styleUrl: './get-lobby-code.component.scss'
})
export class GetLobbyCodeComponent {
  buttonLabel = 'Copy Lobby Link';

  constructor(
    private clipboard: Clipboard,
  ) { }

  copyLobbyLink(): void {
    const currentUrl = window.location.href;

    const success = this.clipboard.copy(currentUrl);
  }
}
