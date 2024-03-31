import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transaction-form',
  templateUrl: './transaction-form.component.html',
  //styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent {
  transactionForm: FormGroup;

  constructor(private fb: FormBuilder, private transactionService: TransactionService) {
    this.transactionForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      amount: [null, [Validators.required, Validators.pattern(/^\d+\.?\d*$/)]],
      category: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.transactionForm.valid) {
      this.transactionService.addTransaction(this.transactionForm.value).subscribe({
        next: (result) => {
          console.log(result);
          this.transactionForm.reset();
        },
        error: (error) => console.error('There was an error!', error)
      });
    }
  }
}
