import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LobbyComponent } from './lobbys/lobby/lobby.component';
import { JoinLobbyComponent } from './lobbys/join-lobby/join-lobby.component';

export const routes: Routes = [
  { path: '', component: JoinLobbyComponent },
  { path: 'lobby/:lobbyCode', component: LobbyComponent },
  { path: 'lobby/', component: LobbyComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
