import { Component } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { phosphorCopySimpleFill } from '@ng-icons/phosphor-icons/fill';
import { NgIcon, provideIcons } from '@ng-icons/core';

@Component({
  selector: 'app-get-lobby-code',
  imports: [ButtonModule, NgIcon],
  templateUrl: './get-lobby-code.component.html',
  styleUrl: './get-lobby-code.component.scss',
  providers: [provideIcons({ phosphorCopySimpleFill })],
})
export class GetLobbyCodeComponent {
  constructor(private clipboard: Clipboard) {}

  copyLobbyLink(): void {
    const currentUrl = window.location.href;
    const success = this.clipboard.copy(currentUrl);
  }
}
