import { Component, OnInit } from '@angular/core';
import { Transaction, TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transactions-list',
  templateUrl: './transactions-list.component.html',
  styleUrls: ['./transactions-list.component.css']
})
export class TransactionsListComponent implements OnInit {
  transactions: any[] = [];
  currentPage = 1;
  totalPages = 0;

  constructor(private transactionService: TransactionService) { }

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(page = 1): void {
    this.transactionService.getTransactions(page).subscribe(data => {
      this.transactions = data.transactions;
      this.totalPages = data.totalPages;
      this.currentPage = data.currentPage;
    });
  }

  goToPage(page: number): void {
    this.loadTransactions(page);
  }
}
