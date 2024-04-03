import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent {
  transactionForm: FormGroup;
  categories: string[] = [];
  isNewCategory = false;
  newCategory = '';

  constructor(private fb: FormBuilder, private transactionService: TransactionService, private snackbarService: SnackbarService) {
    this.transactionForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      amount: [null, [Validators.required, Validators.pattern(/^\d+\.?\d*$/)]],
      category: ['', Validators.required]
    });

    this.transactionService.getTransactions().subscribe((transactions: Transaction[]) => {
      this.categories = [...new Set(transactions.map(t => t.category))];
    });
  }

  onCategoryChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement.value === 'add-new') {
      this.isNewCategory = true;
      this.transactionForm.get('category').reset();
    } else {
      this.isNewCategory = false;
    }
  }

  onSubmit(): void {
    if (this.isNewCategory) {
      this.transactionForm.get('category').setValue(this.newCategory);
    }
    if (this.transactionForm.valid) {
      this.transactionService.addTransaction(this.transactionForm.value).subscribe({
        next: (result) => {
          console.log(result);
          this.snackbarService.show('Transaction added successfully!');
          this.transactionForm.reset();
        },
        error: (error) => {
          console.error('There was an error!', error);
          this.snackbarService.show('Failed to add transaction. Please try again.');
        }
      });
    } else {
      // Trigger validation feedback.
      this.snackbarService.show('Please fill out the form correctly.');
    }
  }
}
