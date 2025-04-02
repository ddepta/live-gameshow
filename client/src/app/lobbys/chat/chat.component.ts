import { Component, ElementRef, ViewChild } from '@angular/core';
import { MessageService } from '../../message.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { phosphorPaperPlaneTilt } from '@ng-icons/phosphor-icons/regular';
import { NgIcon, provideIcons } from '@ng-icons/core';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  imports: [FormsModule, CommonModule, ButtonModule, InputTextModule, NgIcon],
  providers: [provideIcons({ phosphorPaperPlaneTilt })],
})
export class ChatComponent {
  @ViewChild('messagesArea') private messagesArea!: ElementRef;

  newMessage = '';
  messageList: string[] = [];

  constructor(private messageService: MessageService) {}

  ngOnInit() {
    this.messageService.getNewMessage().subscribe((message: string) => {
      this.messageList.push(message);
      this.scrollToBottom();
    });
  }

  sendMessage() {
    if (this.newMessage.trim()) {
      console.log('sendMessage: ', this.newMessage);
      this.messageService.sendMessage(this.newMessage);
      this.newMessage = '';
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.messagesArea.nativeElement.scrollTop =
          this.messagesArea.nativeElement.scrollHeight;
      } catch (err) {}
    }, 50);
  }
}
