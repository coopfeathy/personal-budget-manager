import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransactionsListComponent } from './components/transactions-list/transactions-list.component';
import { TransactionFormComponent } from './components/transaction-form/transaction-form.component';

import { TransactionDetailComponent } from './components/transaction-detail/transaction-detail.component';


const routes: Routes = [
  { path: '', redirectTo: '/transactions', pathMatch: 'full' },
  { path: 'transactions', component: TransactionsListComponent },
  { path: 'add', component: TransactionFormComponent },
  // Route for viewing a single transaction's detail
  { path: 'transactions/:id', component: TransactionDetailComponent },
  // Reusing TransactionFormComponent for editing, assuming you pass an ID
  { path: 'edit/:id', component: TransactionFormComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
