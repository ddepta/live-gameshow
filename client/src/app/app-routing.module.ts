import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LobbyComponent } from './lobbys/lobby/lobby.component';
import { JoinLobbyComponent } from './lobbys/join-lobby/join-lobby.component';
import { GameComponent } from './game/game.component';

export const routes: Routes = [
  { path: '', component: JoinLobbyComponent },
  { path: 'lobby/:lobbyCode', component: LobbyComponent },
  { path: 'lobby/', component: LobbyComponent },
  { path: 'game/:lobbyCode', component: GameComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
