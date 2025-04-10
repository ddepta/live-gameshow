import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBinary } from '@ng-icons/phosphor-icons/regular';
import {
  phosphorBinaryBold,
  phosphorSpeakerHighBold,
  phosphorSpeakerXBold,
} from '@ng-icons/phosphor-icons/bold';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIcon],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [
    provideIcons({
      phosphorBinaryBold,
      phosphorSpeakerHighBold,
      phosphorSpeakerXBold,
      phosphorBinary,
    }),
  ],
})
export class AppComponent implements OnInit {
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  constructor(private primeng: PrimeNG) {}
  title = 'livestream-quiz';
  gradientEnabled = false; // Default gradient state is disabled
  isPlaying = false; // Track music playback state

  // Radio stream URL
  readonly streamUrl = 'https://streams.radio.co/s0aa1e6f4a/listen';

  ngOnInit() {
    // Initialize DOM with the gradient-disabled class
    document.documentElement.classList.toggle(
      'gradient-disabled',
      !this.gradientEnabled
    );
  }

  toggleGradient() {
    this.gradientEnabled = !this.gradientEnabled;
    document.documentElement.classList.toggle(
      'gradient-disabled',
      !this.gradientEnabled
    );
  }

  toggleMusic() {
    const audio = this.audioPlayerRef.nativeElement;

    if (this.isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error('Error playing audio:', err);
      });
    }

    this.isPlaying = !this.isPlaying;
  }
}
