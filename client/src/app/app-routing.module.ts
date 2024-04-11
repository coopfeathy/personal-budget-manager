import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransactionsListComponent } from './components/transactions-list/transactions-list.component';
import { TransactionFormComponent } from './components/transaction-form/transaction-form.component';

import { TransactionDetailComponent } from './components/transaction-detail/transaction-detail.component';


const routes: Routes = [
  { path: '', redirectTo: '/transactions', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
