import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

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
  startDate: string;
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

interface FinanceStateModel {
  accounts: Account[];
  budgets: BudgetCategory[];
  transactions: Transaction[];
  autoPayments: AutoPayment[];
  passiveIncomeStreams: PassiveIncomeStream[];
  cryptoHoldings: CryptoHolding[];
  savingsGoals: SavingsGoal[];
}

interface NetWorthPoint {
  label: string;
  cash: number;
  crypto: number;
  passive: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private saveIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly tokenStorageKey = 'pbm_owner_token';
  readonly appName = 'Personal Budget Manager';
  readonly insights = [
    'Target fixed costs below 55% of monthly net income to increase cashflow flexibility.',
    'Fund an emergency reserve covering 6 months of core expenses.',
    'Auto-transfer passive income to savings goals first, then discretionary spending.'
  ];

  today = new Date().toISOString().slice(0, 10);
  isAuthenticated = false;
  isAuthLoading = false;
  authError = '';
  saveStatus = 'Sign in to load your production data.';
  lastSyncedAt: string | null = null;
  isSaving = false;
  isDirty = false;

  loginForm = {
    email: '',
    accessCode: ''
  };

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
      targetDate: '2026-12-31',
      startDate: '2025-01-01'
    },
    {
      id: 'goal-2',
      name: 'Travel Fund',
      targetAmount: 5500,
      currentAmount: 1700,
      targetDate: '2026-08-01',
      startDate: '2025-09-01'
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

  get totalLiquidAssets(): number {
    return this.accounts
      .filter(account => account.type !== 'credit-card')
      .reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  }

  get averageMonthlyExpenses(): number {
    return this.monthlyExpenses + this.autoPaymentTotal;
  }

  get monthsOfRunway(): number {
    const expenses = this.averageMonthlyExpenses;
    if (!expenses) {
      return 0;
    }

    return this.totalLiquidAssets / expenses;
  }

  get runwayPercent(): number {
    return Math.min((this.monthsOfRunway / 12) * 100, 100);
  }

  get runwayStatusLabel(): string {
    if (this.monthsOfRunway < 3) {
      return 'Critical';
    }

    if (this.monthsOfRunway < 6) {
      return 'Watch';
    }

    return 'Healthy';
  }

  get runwayStatusClass(): string {
    if (this.monthsOfRunway < 3) {
      return 'status-danger';
    }

    if (this.monthsOfRunway < 6) {
      return 'status-warning';
    }

    return 'status-success';
  }

  get netWorthHistory(): NetWorthPoint[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const cashBase = this.cashAndCardBalance;
    const cryptoBase = this.cryptoPortfolioValue;
    const passiveBase = this.passiveIncomeStreams.reduce((sum, stream) => sum + stream.receivedYtd, 0);

    return months.map((label, index) => ({
      label,
      cash: Math.max(cashBase * (0.82 + index * 0.03), 0),
      crypto: Math.max(cryptoBase * (0.74 + index * 0.05), 0),
      passive: Math.max(passiveBase * (0.7 + index * 0.06), 0)
    }));
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

  ngOnInit(): void {
    this.restoreSession();
    this.saveIntervalId = setInterval(() => {
      if (this.isAuthenticated && this.isDirty && !this.isSaving) {
        void this.saveState();
      }
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }
  }

  async signIn(): Promise<void> {
    if (!this.loginForm.email.trim() || !this.loginForm.accessCode) {
      this.authError = 'Email and access code are required.';
      return;
    }

    this.isAuthLoading = true;
    this.authError = '';

    try {
      const response = await firstValueFrom(this.http.post<{ ok: boolean; token: string }>('/api/auth-login', {
        email: this.loginForm.email.trim(),
        accessCode: this.loginForm.accessCode
      }));

      if (!response?.ok || !response.token) {
        this.authError = 'Login failed.';
        return;
      }

      localStorage.setItem(this.tokenStorageKey, response.token);
      this.isAuthenticated = true;
      this.saveStatus = 'Authenticated. Loading your finance state...';
      await this.loadState();
    } catch (error: unknown) {
      this.authError = 'Unable to sign in. Confirm your owner credentials in Netlify env variables.';
      console.error(error);
    } finally {
      this.isAuthLoading = false;
    }
  }

  signOut(): void {
    localStorage.removeItem(this.tokenStorageKey);
    this.isAuthenticated = false;
    this.authError = '';
    this.saveStatus = 'Signed out. Sign in to continue.';
  }

  async saveState(): Promise<void> {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!token) {
      this.signOut();
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'Saving secure state...';

    try {
      await firstValueFrom(this.http.put(
        '/api/finance-state',
        { state: this.buildStateModel() },
        { headers: { Authorization: `Bearer ${token}` } }
      ));

      this.isDirty = false;
      this.lastSyncedAt = new Date().toISOString();
      this.saveStatus = `Saved at ${new Date().toLocaleTimeString()}.`;
    } catch (error: unknown) {
      this.saveStatus = 'Save failed. Check auth session or backend configuration.';
      console.error(error);
    } finally {
      this.isSaving = false;
    }
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
    this.markDirty();

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
    this.markDirty();
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
    this.markDirty();
  }

  markPaid(paymentId: string): void {
    this.autoPayments = this.autoPayments.map(payment =>
      payment.id === paymentId
        ? { ...payment, lastPaid: this.today }
        : payment
    );
      this.markDirty();
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
    this.markDirty();
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
    this.markDirty();
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

  getGoalMonthlyRequirement(goal: SavingsGoal): number {
    const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
    const monthsRemaining = Math.max(this.monthsBetween(this.today, goal.targetDate), 1);
    return remaining / monthsRemaining;
  }

  isGoalBehind(goal: SavingsGoal): boolean {
    const start = new Date(goal.startDate).getTime();
    const target = new Date(goal.targetDate).getTime();
    const now = new Date(this.today).getTime();

    if (target <= start) {
      return false;
    }

    const elapsedRatio = Math.min(Math.max((now - start) / (target - start), 0), 1);
    const expectedAmount = goal.targetAmount * elapsedRatio;

    return goal.currentAmount < expectedAmount;
  }

  getStackPercent(point: NetWorthPoint, key: 'cash' | 'crypto' | 'passive'): number {
    const total = point.cash + point.crypto + point.passive;
    if (!total) {
      return 0;
    }

    return (point[key] / total) * 100;
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

    this.markDirty();
  }

  private async restoreSession(): Promise<void> {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!token) {
      this.isAuthenticated = false;
      return;
    }

    try {
      const response = await firstValueFrom(this.http.get<{ ok: boolean }>('/api/auth-me', {
        headers: { Authorization: `Bearer ${token}` }
      }));

      if (!response?.ok) {
        this.signOut();
        return;
      }

      this.isAuthenticated = true;
      await this.loadState();
    } catch (error: unknown) {
      console.error(error);
      this.signOut();
    }
  }

  private async loadState(): Promise<void> {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!token) {
      this.signOut();
      return;
    }

    try {
      const response = await firstValueFrom(this.http.get<{ ok: boolean; state: FinanceStateModel | null; updatedAt: string | null }>(
        '/api/finance-state',
        { headers: { Authorization: `Bearer ${token}` } }
      ));

      if (response?.state) {
        this.applyStateModel(response.state);
      }

      this.lastSyncedAt = response?.updatedAt || null;
      this.saveStatus = response?.updatedAt
        ? `Loaded secure state from ${new Date(response.updatedAt).toLocaleString()}.`
        : 'No server state yet. Your first save will create it.';
      this.isDirty = false;
    } catch (error: unknown) {
      this.saveStatus = 'Authenticated, but failed to load server state.';
      console.error(error);
    }
  }

  private buildStateModel(): FinanceStateModel {
    return {
      accounts: this.accounts,
      budgets: this.budgets,
      transactions: this.transactions,
      autoPayments: this.autoPayments,
      passiveIncomeStreams: this.passiveIncomeStreams,
      cryptoHoldings: this.cryptoHoldings,
      savingsGoals: this.savingsGoals
    };
  }

  private applyStateModel(model: FinanceStateModel): void {
    this.accounts = model.accounts || this.accounts;
    this.budgets = model.budgets || this.budgets;
    this.transactions = model.transactions || this.transactions;
    this.autoPayments = model.autoPayments || this.autoPayments;
    this.passiveIncomeStreams = model.passiveIncomeStreams || this.passiveIncomeStreams;
    this.cryptoHoldings = model.cryptoHoldings || this.cryptoHoldings;
    this.savingsGoals = (model.savingsGoals || this.savingsGoals).map(goal => ({
      ...goal,
      startDate: goal.startDate || this.today
    }));
  }

  private monthsBetween(fromIso: string, toIso: string): number {
    const from = new Date(fromIso);
    const to = new Date(toIso);

    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    return Math.max(months + (to.getDate() >= from.getDate() ? 0 : -1), 0);
  }

  private markDirty(): void {
    if (!this.isAuthenticated) {
      return;
    }

    this.isDirty = true;
    this.saveStatus = 'Unsaved changes.';
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