import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgForm } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
import { Location } from '@angular/common'; // For navigating back

@Component({
  selector: 'app-transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent implements OnInit {
  transaction: any = {}; // Placeholder for the transaction to edit

  constructor(
    private transactionService: TransactionService,
    private route: ActivatedRoute,
    private location: Location
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.transactionService.getTransaction(id).subscribe(transaction => {
        this.transaction = transaction;
      });
    }
  }

  onSubmit(form: NgForm): void {
    if (this.transaction._id) {
      this.transactionService.updateTransaction(this.transaction._id, form.value).subscribe(() => {
        this.location.back(); // Navigate back after update
      });
    } else {
      this.transactionService.addTransaction(form.value).subscribe(() => {
        form.reset();
        this.location.back(); // Navigate back after add
      });
    }
  }
}
