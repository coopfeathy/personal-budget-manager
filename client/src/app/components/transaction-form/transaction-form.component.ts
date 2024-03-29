import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent {

  constructor(private transactionService: TransactionService) { }

  onSubmit(form: NgForm): void {
    this.transactionService.addTransaction(form.value).subscribe(result => {
      console.log(result);
      form.reset();
    });
  }
}
