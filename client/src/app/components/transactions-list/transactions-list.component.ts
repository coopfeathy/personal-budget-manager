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
    this.transactionService.getTransactions().subscribe({
      next: (transactions: Transaction[]) => {
        this.transactions = transactions;
        this.categories = [...new Set(transactions.map(t => t.category))];
      },
      error: (error) => console.error('Error fetching transactions:', error)
    });
  }

  getTransactionsByCategory(category: string): Transaction[] {
    return this.transactions.filter(t => t.category === category);
  }
}
