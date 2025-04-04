import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { MessageService, Message } from '../../message.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { phosphorPaperPlaneTilt } from '@ng-icons/phosphor-icons/regular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

interface SentMessage {
  text: string;
  timestamp: number;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  imports: [FormsModule, CommonModule, ButtonModule, InputTextModule, NgIcon],
  providers: [provideIcons({ phosphorPaperPlaneTilt })],
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') private messagesArea!: ElementRef;

  newMessage = '';
  messageList: Message[] = [];
  private messageSubscription?: Subscription;
  private cleanupSubscription?: Subscription;
  private sentMessages: SentMessage[] = [];
  private isComponentActive = true;
  private username: string = '';

  constructor(private messageService: MessageService) {
    // Get username from localStorage
    this.username = localStorage.getItem('username') || '';
    console.log('Current username:', this.username);
  }

  ngOnInit() {
    this.messageSubscription = this.messageService
      .getNewMessage()
      .subscribe((message: Message) => {
        if (message.text) {
          console.log('Received message:', message);

          // Check if this is our own message by comparing usernames
          if (message.username === this.username) {
            message.isSelf = true;
          }

          // Also check sent messages list as fallback (for legacy support)
          if (!message.isSelf && !message.username) {
            const sentMessageIndex = this.sentMessages.findIndex(
              (msg) => msg.text === message.text
            );

            if (sentMessageIndex !== -1) {
              message.isSelf = true;
              this.sentMessages.splice(sentMessageIndex, 1);
            }
          }

          // Check for duplicates
          const isDuplicate = this.messageList.some(
            (m) => m.text === message.text && m.username === message.username
          );

          if (!isDuplicate) {
            this.messageList.push(message);
            this.scrollToBottom();
          }
        }
      });

    // Cleanup old sent messages periodically
    this.cleanupSubscription = interval(5000)
      .pipe(takeWhile(() => this.isComponentActive))
      .subscribe(() => this.cleanupOldSentMessages());
  }

  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    if (this.cleanupSubscription) {
      this.cleanupSubscription.unsubscribe();
    }

    this.isComponentActive = false;
  }

  sendMessage() {
    if (this.newMessage.trim()) {
      console.log('Sending message:', this.newMessage);

      // Track this message as one we sent
      this.sentMessages.push({
        text: this.newMessage,
        timestamp: Date.now(),
      });

      this.messageService.sendMessage(this.newMessage);
      this.newMessage = '';
      this.scrollToBottom();
    }
  }

  private cleanupOldSentMessages() {
    const now = Date.now();
    const timeout = 10000; // 10 seconds

    // Remove messages older than the timeout
    this.sentMessages = this.sentMessages.filter(
      (msg) => now - msg.timestamp < timeout
    );
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
