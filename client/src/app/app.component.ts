import { Component } from '@angular/core';
import { Transaction } from './services/transaction.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showForm = false;
  selectedTransaction: Transaction | null = null;

  openForm() {
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  selectTransaction(transaction: Transaction) {
    this.selectedTransaction = transaction;
  }
}