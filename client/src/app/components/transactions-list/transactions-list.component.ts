import { Component, OnInit } from '@angular/core';
import { Transaction, TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transactions-list',
  templateUrl: './transactions-list.component.html',
  styleUrls: ['./transactions-list.component.css']
})
export class TransactionsListComponent implements OnInit {
  transactions: any[] = [];
  categories: string[] = [];

  constructor(private transactionService: TransactionService) { }

  ngOnInit() {
    this.transactionService.getTransactions().subscribe((response: any) => {
      if (!Array.isArray(response.transactions)) {
        console.error('transactions is not an array:', response.transactions);
        return;
      }
  
      this.transactions = response.transactions;
      this.categories = [...new Set(this.transactions.map(t => t.category))];
    });
  }

  getTransactionsByCategory(category: string): Transaction[] {
    return this.transactions.filter(t => t.category === category);
  }
}
