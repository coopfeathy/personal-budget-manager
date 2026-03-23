import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  date: string;
  accountId: string;
  notes?: string;
  tags?: string[];
}

interface BudgetCategory {
  id: string;
  name: string;
  monthlyLimit: number;
  spent: number;
}

interface AutoPayment {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  accountId: string;
  isActive: boolean;
  lastPaid?: string;
}

interface PassiveIncomeStream {
  id: string;
  source: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  expectedAmount: number;
  receivedYtd: number;
  nextPayout: string;
}

interface CryptoHolding {
  id: string;
  symbol: string;
  assetName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  platform: string;
  stakingYield?: number;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

interface Account {
  id: string;
  name: string;
  institution: string;
  type: 'checking' | 'credit-card' | 'savings' | 'investment';
  last4: string;
  balance: number;
  syncStatus: 'manual' | 'connected' | 'needs-attention';
}

interface ConnectionProvider {
  name: string;
  status: 'connected' | 'available' | 'coming-soon';
  note: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  readonly appName = 'Personal Budget Manager';
  readonly insights = [
    'Target fixed costs below 55% of monthly net income to increase cashflow flexibility.',
    'Fund an emergency reserve covering 6 months of core expenses.',
    'Auto-transfer passive income to savings goals first, then discretionary spending.'
  ];

  today = new Date().toISOString().slice(0, 10);

  accounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Primary Checking',
      institution: 'Chase',
      type: 'checking',
      last4: '1442',
      balance: 7284,
      syncStatus: 'manual'
    },
    {
      id: 'acc-2',
      name: 'Rewards Visa',
      institution: 'Capital One',
      type: 'credit-card',
      last4: '8891',
      balance: -1265,
      syncStatus: 'needs-attention'
    },
    {
      id: 'acc-3',
      name: 'HYSA Reserve',
      institution: 'Ally',
      type: 'savings',
      last4: '2207',
      balance: 15300,
      syncStatus: 'manual'
    }
  ];

  budgets: BudgetCategory[] = [
    { id: 'bud-1', name: 'Housing', monthlyLimit: 1900, spent: 1800 },
    { id: 'bud-2', name: 'Groceries', monthlyLimit: 650, spent: 420 },
    { id: 'bud-3', name: 'Transportation', monthlyLimit: 400, spent: 230 },
    { id: 'bud-4', name: 'Entertainment', monthlyLimit: 350, spent: 175 }
  ];

  transactions: Transaction[] = [
    {
      id: 'txn-1',
      title: 'Apartment Rent',
      amount: 1800,
      category: 'Housing',
      type: 'expense',
      date: this.today,
      accountId: 'acc-1',
      tags: ['fixed-cost', 'monthly']
    },
    {
      id: 'txn-2',
      title: 'Payroll Deposit',
      amount: 4800,
      category: 'Salary',
      type: 'income',
      date: this.today,
      accountId: 'acc-1',
      tags: ['income']
    },
    {
      id: 'txn-3',
      title: 'Grocery Run',
      amount: 142,
      category: 'Groceries',
      type: 'expense',
      date: this.today,
      accountId: 'acc-2',
      tags: ['food']
    }
  ];

  autoPayments: AutoPayment[] = [
    {
      id: 'auto-1',
      name: 'Internet Service',
      amount: 95,
      dueDay: 8,
      category: 'Utilities',
      accountId: 'acc-1',
      isActive: true,
      lastPaid: this.today
    },
    {
      id: 'auto-2',
      name: 'Student Loan',
      amount: 265,
      dueDay: 19,
      category: 'Debt',
      accountId: 'acc-1',
      isActive: true,
      lastPaid: this.today
    }
  ];

  passiveIncomeStreams: PassiveIncomeStream[] = [
    {
      id: 'inc-1',
      source: 'Dividend ETF',
      frequency: 'quarterly',
      expectedAmount: 180,
      receivedYtd: 360,
      nextPayout: this.today
    },
    {
      id: 'inc-2',
      source: 'Rental Suite',
      frequency: 'monthly',
      expectedAmount: 1250,
      receivedYtd: 3750,
      nextPayout: this.today
    }
  ];

  cryptoHoldings: CryptoHolding[] = [
    {
      id: 'crypto-1',
      symbol: 'BTC',
      assetName: 'Bitcoin',
      quantity: 0.35,
      averageCost: 41200,
      currentPrice: 66300,
      platform: 'Coinbase',
      stakingYield: 0
    },
    {
      id: 'crypto-2',
      symbol: 'ETH',
      assetName: 'Ethereum',
      quantity: 3.8,
      averageCost: 2250,
      currentPrice: 3400,
      platform: 'Kraken',
      stakingYield: 3.4
    }
  ];

  savingsGoals: SavingsGoal[] = [
    {
      id: 'goal-1',
      name: 'Emergency Fund',
      targetAmount: 22000,
      currentAmount: 15300,
      targetDate: '2026-12-31'
    },
    {
      id: 'goal-2',
      name: 'Travel Fund',
      targetAmount: 5500,
      currentAmount: 1700,
      targetDate: '2026-08-01'
    }
  ];

  connectionProviders: ConnectionProvider[] = [
    {
      name: 'Plaid Aggregation',
      status: 'available',
      note: 'Best for connecting most US banks and card issuers.'
    },
    {
      name: 'MX Aggregation',
      status: 'coming-soon',
      note: 'Alternative aggregator for improved institution coverage.'
    },
    {
      name: 'CSV Import',
      status: 'connected',
      note: 'Works today for any card account export.'
    }
  ];

  newTransaction = {
    title: '',
    amount: 0,
    category: 'Groceries',
    type: 'expense' as 'expense' | 'income',
    date: this.today,
    accountId: 'acc-1',
    notes: ''
  };

  newBudget = {
    name: '',
    monthlyLimit: 0
  };

  newAutoPayment = {
    name: '',
    amount: 0,
    dueDay: 1,
    category: 'Utilities',
    accountId: 'acc-1'
  };

  newIncomeStream = {
    source: '',
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly',
    expectedAmount: 0,
    nextPayout: this.today
  };

  newCryptoHolding = {
    symbol: '',
    assetName: '',
    quantity: 0,
    averageCost: 0,
    currentPrice: 0,
    platform: ''
  };

  get totalBudgetLimit(): number {
    return this.budgets.reduce((sum, item) => sum + item.monthlyLimit, 0);
  }

  get totalBudgetSpent(): number {
    return this.budgets.reduce((sum, item) => sum + item.spent, 0);
  }

  get monthlyIncome(): number {
    return this.transactions
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get monthlyExpenses(): number {
    return this.transactions
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get netCashFlow(): number {
    return this.monthlyIncome - this.monthlyExpenses;
  }

  get autoPaymentTotal(): number {
    return this.autoPayments
      .filter(payment => payment.isActive)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  get passiveIncomeMonthlyEstimate(): number {
    return this.passiveIncomeStreams.reduce((sum, stream) => {
      if (stream.frequency === 'weekly') {
        return sum + (stream.expectedAmount * 52) / 12;
      }
      if (stream.frequency === 'quarterly') {
        return sum + stream.expectedAmount / 3;
      }

      return sum + stream.expectedAmount;
    }, 0);
  }

  get cryptoPortfolioValue(): number {
    return this.cryptoHoldings.reduce((sum, holding) => sum + (holding.quantity * holding.currentPrice), 0);
  }

  get cashAndCardBalance(): number {
    return this.accounts.reduce((sum, account) => sum + account.balance, 0);
  }

  get netWorth(): number {
    return this.cashAndCardBalance + this.cryptoPortfolioValue;
  }

  get categoryOptions(): string[] {
    const categories = new Set<string>([
      ...this.budgets.map(item => item.name),
      ...this.transactions.map(item => item.category),
      'Utilities',
      'Debt',
      'Insurance',
      'Salary',
      'Investments'
    ]);

    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }

  get accountOptions(): Account[] {
    return this.accounts;
  }

  get recentTransactions(): Transaction[] {
    return [...this.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }

  get upcomingAutoPayments(): AutoPayment[] {
    return [...this.autoPayments]
      .filter(payment => payment.isActive)
      .sort((a, b) => a.dueDay - b.dueDay)
      .slice(0, 6);
  }

  addTransaction(): void {
    if (!this.newTransaction.title.trim() || this.newTransaction.amount <= 0) {
      return;
    }

    const transaction: Transaction = {
      id: this.createId('txn'),
      title: this.newTransaction.title.trim(),
      amount: Number(this.newTransaction.amount),
      category: this.newTransaction.category,
      type: this.newTransaction.type,
      date: this.newTransaction.date,
      accountId: this.newTransaction.accountId,
      notes: this.newTransaction.notes?.trim() || undefined
    };

    this.transactions = [transaction, ...this.transactions];
    this.applyTransactionToBudget(transaction);

    this.newTransaction = {
      title: '',
      amount: 0,
      category: this.categoryOptions[0] || 'Groceries',
      type: 'expense',
      date: this.today,
      accountId: this.accountOptions[0]?.id || '',
      notes: ''
    };
  }

  addBudget(): void {
    if (!this.newBudget.name.trim() || this.newBudget.monthlyLimit <= 0) {
      return;
    }

    this.budgets = [
      ...this.budgets,
      {
        id: this.createId('bud'),
        name: this.newBudget.name.trim(),
        monthlyLimit: Number(this.newBudget.monthlyLimit),
        spent: 0
      }
    ];

    this.newBudget = { name: '', monthlyLimit: 0 };
  }

  addAutoPayment(): void {
    if (!this.newAutoPayment.name.trim() || this.newAutoPayment.amount <= 0) {
      return;
    }

    this.autoPayments = [
      ...this.autoPayments,
      {
        id: this.createId('auto'),
        name: this.newAutoPayment.name.trim(),
        amount: Number(this.newAutoPayment.amount),
        dueDay: Number(this.newAutoPayment.dueDay),
        category: this.newAutoPayment.category,
        accountId: this.newAutoPayment.accountId,
        isActive: true
      }
    ];

    this.newAutoPayment = {
      name: '',
      amount: 0,
      dueDay: 1,
      category: this.categoryOptions[0] || 'Utilities',
      accountId: this.accountOptions[0]?.id || ''
    };
  }

  markPaid(paymentId: string): void {
    this.autoPayments = this.autoPayments.map(payment =>
      payment.id === paymentId
        ? { ...payment, lastPaid: this.today }
        : payment
    );
  }

  addIncomeStream(): void {
    if (!this.newIncomeStream.source.trim() || this.newIncomeStream.expectedAmount <= 0) {
      return;
    }

    this.passiveIncomeStreams = [
      ...this.passiveIncomeStreams,
      {
        id: this.createId('inc'),
        source: this.newIncomeStream.source.trim(),
        frequency: this.newIncomeStream.frequency,
        expectedAmount: Number(this.newIncomeStream.expectedAmount),
        receivedYtd: 0,
        nextPayout: this.newIncomeStream.nextPayout
      }
    ];

    this.newIncomeStream = {
      source: '',
      frequency: 'monthly',
      expectedAmount: 0,
      nextPayout: this.today
    };
  }

  addCryptoHolding(): void {
    if (!this.newCryptoHolding.symbol.trim() || this.newCryptoHolding.quantity <= 0) {
      return;
    }

    this.cryptoHoldings = [
      ...this.cryptoHoldings,
      {
        id: this.createId('crypto'),
        symbol: this.newCryptoHolding.symbol.trim().toUpperCase(),
        assetName: this.newCryptoHolding.assetName.trim() || this.newCryptoHolding.symbol.trim().toUpperCase(),
        quantity: Number(this.newCryptoHolding.quantity),
        averageCost: Number(this.newCryptoHolding.averageCost),
        currentPrice: Number(this.newCryptoHolding.currentPrice),
        platform: this.newCryptoHolding.platform.trim() || 'Exchange'
      }
    ];

    this.newCryptoHolding = {
      symbol: '',
      assetName: '',
      quantity: 0,
      averageCost: 0,
      currentPrice: 0,
      platform: ''
    };
  }

  getBudgetUsagePercent(budget: BudgetCategory): number {
    if (!budget.monthlyLimit) {
      return 0;
    }

    return Math.min((budget.spent / budget.monthlyLimit) * 100, 100);
  }

  getGoalProgress(goal: SavingsGoal): number {
    if (!goal.targetAmount) {
      return 0;
    }

    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  }

  getCryptoProfit(holding: CryptoHolding): number {
    const currentValue = holding.quantity * holding.currentPrice;
    const costBasis = holding.quantity * holding.averageCost;
    return currentValue - costBasis;
  }

  connectProvider(providerName: string): void {
    this.connectionProviders = this.connectionProviders.map(provider => {
      if (provider.name === providerName && provider.status !== 'coming-soon') {
        return {
          ...provider,
          status: 'connected',
          note: `${provider.note} Connection set to demo mode. Add Plaid server token exchange for production.`
        };
      }

      return provider;
    });
  }

  private applyTransactionToBudget(transaction: Transaction): void {
    if (transaction.type !== 'expense') {
      return;
    }

    this.budgets = this.budgets.map(budget => {
      if (budget.name !== transaction.category) {
        return budget;
      }

      return {
        ...budget,
        spent: budget.spent + transaction.amount
      };
    });
  }

  private createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
  }
}