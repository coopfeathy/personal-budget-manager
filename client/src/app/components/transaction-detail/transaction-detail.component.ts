import { Component, Input } from '@angular/core';
import { Transaction } from '../../services/transaction.service';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transaction-detail',
  templateUrl: './transaction-detail.component.html',
  styleUrl: './transaction-detail.component.css'
})
export class TransactionDetailComponent {
  @Input() transaction: Transaction;

  constructor(private transactionService: TransactionService) { }

  deleteTransaction() {
    if (this.transaction && this.transaction._id) {
      this.transactionService.deleteTransaction(this.transaction._id).subscribe(() => {
        // Handle successful deletion here, like refreshing the transaction list
      }, error => {
        console.error('Error deleting transaction:', error);
      });
    }
  }
  
  closeTransactionDetails() {
    this.transaction = null;
  } 
}
