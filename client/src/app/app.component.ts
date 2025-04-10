import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBinaryBold } from '@ng-icons/phosphor-icons/bold';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIcon],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [
    provideIcons({
      phosphorBinaryBold,
    }),
  ],
})
export class AppComponent implements OnInit {
  constructor(private primeng: PrimeNG) {}
  title = 'livestream-quiz';
  gradientEnabled = false; // Default gradient state is now disabled

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
}
