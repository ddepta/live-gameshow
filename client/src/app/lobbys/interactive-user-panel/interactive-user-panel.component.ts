import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-interactive-user-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interactive-user-panel.component.html',
  styleUrl: './interactive-user-panel.component.scss',
})
export class InteractiveUserPanelComponent {
  users = [
    { name: 'User 1' },
    { name: 'User 2' },
    { name: 'User 3' },
    { name: 'User 4' },
    { name: 'User 5' },
    { name: 'User 6' },
    { name: 'User 7' },
    { name: 'User 8' },
    { name: 'User 9' },
    { name: 'User 10' },
  ];
}
