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
  frequency: 'secondly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  assetType: 'usd' | 'btc';
  expectedAmount: number;
  receivedYtd: number;
  nextPayout: string;
}

interface PassivePayoutEvent {
  id: string;
  streamId: string;
  amount: number;
  assetType: 'usd' | 'btc';
  paidAt: string;
  note?: string;
}

interface CryptoPriceCacheEntry {
  price: number;
  source: 'coingecko' | 'coinbase' | 'cache';
  fetchedAt: string;
}

interface CryptoHistoryPoint {
  timestamp: number;
  label: string;
  price: number;
}

interface RothIraProfile {
  currentBalance: number;
  yearlyContribution: number;
  yearlyLimit: number;
  employerMatchPercent: number;
  expectedAnnualReturn: number;
  contributionsYtd: number;
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

interface WalletTracker {
  id: string;
  label: string;
  chain: 'bitcoin' | 'ethereum' | 'litecoin' | 'dogecoin';
  address: string;
  balance: number;
  unit: string;
  txCount: number;
  lastSyncedAt?: string;
}

interface WalmartListItem {
  id: string;
  query: string;
  currentPrice: number | null;
  currency: string;
  productName: string;
  productUrl: string;
  lastCheckedAt?: string;
}

interface WalmartSuggestionItem {
  productName: string;
  price: number | null;
  productUrl: string;
}

interface FinanceStateModel {
  accounts: Account[];
  budgets: BudgetCategory[];
  transactions: Transaction[];
  autoPayments: AutoPayment[];
  passiveIncomeStreams: PassiveIncomeStream[];
  passivePayoutEvents: PassivePayoutEvent[];
  cryptoHoldings: CryptoHolding[];
  cryptoPriceCache: Record<string, CryptoPriceCacheEntry>;
  walletTrackers: WalletTracker[];
  walmartList: WalmartListItem[];
  savingsGoals: SavingsGoal[];
  rothIra: RothIraProfile;
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
  private cryptoSyncIntervalId: ReturnType<typeof setInterval> | null = null;
  private notificationIntervalId: ReturnType<typeof setInterval> | null = null;
  private walletSyncIntervalId: ReturnType<typeof setInterval> | null = null;
  private walmartSuggestTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastNotificationAt: Record<string, number> = {};

  private readonly symbolToCoinId: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    BNB: 'binancecoin',
    TRX: 'tron',
    SUI: 'sui',
    TON: 'the-open-network',
    HBAR: 'hedera-hashgraph',
    SHIB: 'shiba-inu',
    PEPE: 'pepe',
    NEAR: 'near',
    APT: 'aptos',
    ADA: 'cardano',
    XRP: 'ripple',
    DOGE: 'dogecoin',
    AVAX: 'avalanche-2',
    MATIC: 'matic-network',
    ICP: 'internet-computer',
    ETC: 'ethereum-classic',
    FIL: 'filecoin',
    ALGO: 'algorand',
    DOT: 'polkadot',
    LINK: 'chainlink',
    LTC: 'litecoin',
    BCH: 'bitcoin-cash',
    XMR: 'monero',
    VET: 'vechain',
    AAVE: 'aave',
    INJ: 'injective-protocol',
    XLM: 'stellar',
    UNI: 'uniswap',
    ATOM: 'cosmos',
    OP: 'optimism',
    ARB: 'arbitrum'
  };

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
  isCryptoSyncing = false;
  cryptoPriceStatus = 'Waiting for holdings to sync live prices.';
  lastCryptoSyncedAt: string | null = null;
  notificationsEnabled = false;
  activePage: 'dashboard' | 'walmart' = 'dashboard';

  cryptoHistoryRange: '7d' | '30d' | '1y' = '30d';
  cryptoHistoryPoints: CryptoHistoryPoint[] = [];
  isCryptoHistoryLoading = false;
  cryptoHistoryStatus = 'Select a range to load real market history.';

  loginForm = {
    email: '',
    accessCode: ''
  };

  accounts: Account[] = [];

  budgets: BudgetCategory[] = [];

  transactions: Transaction[] = [];

  autoPayments: AutoPayment[] = [];

  passiveIncomeStreams: PassiveIncomeStream[] = [];

  passivePayoutEvents: PassivePayoutEvent[] = [];

  cryptoHoldings: CryptoHolding[] = [];

  cryptoPriceCache: Record<string, CryptoPriceCacheEntry> = {};

  walletTrackers: WalletTracker[] = [];

  walmartList: WalmartListItem[] = [];

  walmartSuggestions: WalmartSuggestionItem[] = [];
  selectedWalmartSuggestion: WalmartSuggestionItem | null = null;
  isWalmartSuggesting = false;

  isWalletSyncing = false;
  walletSyncStatus = 'Add a cold wallet address to auto track balances and transactions.';

  isWalmartLoading = false;
  walmartStatus = 'Add items to begin Walmart price tracking.';

  savingsGoals: SavingsGoal[] = [];

  rothIra: RothIraProfile = {
    currentBalance: 0,
    yearlyContribution: 0,
    yearlyLimit: 7000,
    employerMatchPercent: 0,
    expectedAnnualReturn: 7,
    contributionsYtd: 0
  };

  newRothContribution = 0;

  newPayoutEvent = {
    streamId: '',
    amount: 0,
    assetType: 'usd' as 'usd' | 'btc',
    paidAt: this.today,
    note: ''
  };

  connectionProviders: ConnectionProvider[] = [
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
    accountId: '',
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
    accountId: ''
  };

  newIncomeStream = {
    source: '',
    frequency: 'monthly' as 'secondly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    assetType: 'usd' as 'usd' | 'btc',
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

  newWalletTracker = {
    label: '',
    chain: 'bitcoin' as WalletTracker['chain'],
    address: ''
  };

  newWalmartItem = {
    query: ''
  };

  newAccount = {
    name: '',
    institution: '',
    type: 'checking' as 'checking' | 'credit-card' | 'savings' | 'investment',
    last4: '',
    balance: 0
  };

  newSavingsGoal = {
    name: '',
    targetAmount: 0,
    currentAmount: 0,
    targetDate: this.today
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
    return this.passiveIncomeYearlyEstimate / 12;
  }

  get passiveIncomeYearlyEstimate(): number {
    return this.passiveIncomeStreams.reduce((sum, stream) => sum + this.getPassiveStreamUsdPerYear(stream), 0);
  }

  get passiveIncomePerSecondEstimate(): number {
    return this.passiveIncomeYearlyEstimate / (365 * 24 * 60 * 60);
  }

  get passiveIncomeBtcYearly(): number {
    return this.passiveIncomeStreams.reduce((sum, stream) => {
      if (stream.assetType !== 'btc') {
        return sum;
      }
      return sum + this.getCadenceFactorPerYear(stream.frequency) * stream.expectedAmount;
    }, 0);
  }

  get btcUsdPrice(): number {
    const btcHolding = this.cryptoHoldings.find(holding => holding.symbol.toUpperCase() === 'BTC');
    return btcHolding?.currentPrice || 0;
  }

  get rothIraRemainingContribution(): number {
    return Math.max(this.rothIra.yearlyLimit - this.rothIra.contributionsYtd, 0);
  }

  get rothIraProjectedYearEndBalance(): number {
    const annualRate = Math.max(this.rothIra.expectedAnnualReturn, 0) / 100;
    const projectedGrowth = this.rothIra.currentBalance * annualRate;
    const projectedContrib = this.rothIra.yearlyContribution;
    const projectedMatch = projectedContrib * (Math.max(this.rothIra.employerMatchPercent, 0) / 100);
    return this.rothIra.currentBalance + projectedGrowth + projectedContrib + projectedMatch;
  }

  get rothContributionPaceWarning(): string {
    if (!this.rothIra.yearlyLimit) {
      return 'Set your annual limit to track contribution pace.';
    }
    if (this.rothIra.contributionsYtd > this.rothIra.yearlyLimit) {
      return 'Warning: contributions exceed current yearly IRA limit.';
    }

    const dayOfYear = Math.max(this.getDayOfYear(new Date()), 1);
    const paceAnnualized = (this.rothIra.contributionsYtd / dayOfYear) * 365;
    if (paceAnnualized > this.rothIra.yearlyLimit) {
      return 'Warning: current contribution pace may exceed annual limit.';
    }
    return 'On pace: current contribution rate is within annual limit.';
  }

  get rothIncomeGuidance(): string {
    const income = Math.max(this.monthlyIncome, 0) * 12;
    if (!income) {
      return 'Log income to enable MAGI-based Roth IRA contribution guidance.';
    }

    if (income > 161000) {
      return 'Income appears high for full direct Roth contribution (single filer). Consider backdoor Roth strategy with a tax advisor.';
    }
    if (income > 146000) {
      return 'Income may be in phase-out range (single filer). You may have a reduced Roth contribution limit.';
    }
    return 'Income estimate suggests full direct Roth contribution eligibility for single filer range.';
  }

  get cryptoPortfolioValue(): number {
    return this.cryptoHoldings.reduce((sum, holding) => sum + (holding.quantity * holding.currentPrice), 0);
  }

  get cashAndCardBalance(): number {
    return this.accounts.reduce((sum, account) => sum + account.balance, 0);
  }

  get netWorth(): number {
    return this.cashAndCardBalance + this.cryptoPortfolioValue + this.rothIra.currentBalance;
  }

  get selectedChartSymbol(): string {
    if (this.cryptoHoldings.find(item => item.symbol.toUpperCase() === 'BTC')) {
      return 'BTC';
    }
    return this.cryptoHoldings[0]?.symbol?.toUpperCase() || 'BTC';
  }

  get selectedChartPriceNow(): number {
    const matched = this.cryptoHoldings.find(item => item.symbol.toUpperCase() === this.selectedChartSymbol);
    return matched?.currentPrice || 0;
  }

  get realizedPassiveIncomeUsdYtd(): number {
    return this.passivePayoutEvents.reduce((sum, event) => {
      if (event.assetType === 'btc') {
        return sum + event.amount * this.btcUsdPrice;
      }
      return sum + event.amount;
    }, 0);
  }

  get recentPayoutEvents(): PassivePayoutEvent[] {
    return [...this.passivePayoutEvents]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .slice(0, 10);
  }

  get cryptoHistoryPath(): string {
    if (this.cryptoHistoryPoints.length < 2) {
      return '';
    }

    const prices = this.cryptoHistoryPoints.map(point => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = Math.max(max - min, 1);
    const width = 100;
    const height = 36;

    return this.cryptoHistoryPoints.map((point, idx) => {
      const x = (idx / (this.cryptoHistoryPoints.length - 1)) * width;
      const y = height - ((point.price - min) / range) * height;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }

  get chartStartLabel(): string {
    return this.cryptoHistoryPoints[0]?.label || '--';
  }

  get chartEndLabel(): string {
    return this.cryptoHistoryPoints[this.cryptoHistoryPoints.length - 1]?.label || '--';
  }

  get mainCryptoSymbols(): string[] {
    return [
      'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'TRX',
      'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC', 'BCH', 'ATOM', 'UNI'
    ];
  }

  get trackedWalletCount(): number {
    return this.walletTrackers.length;
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
    this.cryptoSyncIntervalId = setInterval(() => {
      if (this.isAuthenticated && !this.isCryptoSyncing) {
        void this.refreshCryptoPrices();
      }
    }, 60000);
    this.notificationIntervalId = setInterval(() => {
      if (this.isAuthenticated && this.notificationsEnabled) {
        this.runNotificationChecks();
      }
    }, 60000);
    this.walletSyncIntervalId = setInterval(() => {
      if (this.isAuthenticated && !this.isWalletSyncing && this.walletTrackers.length) {
        void this.syncWalletTrackers();
      }
    }, 120000);
  }

  ngOnDestroy(): void {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }
    if (this.cryptoSyncIntervalId) {
      clearInterval(this.cryptoSyncIntervalId);
      this.cryptoSyncIntervalId = null;
    }
    if (this.notificationIntervalId) {
      clearInterval(this.notificationIntervalId);
      this.notificationIntervalId = null;
    }
    if (this.walletSyncIntervalId) {
      clearInterval(this.walletSyncIntervalId);
      this.walletSyncIntervalId = null;
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
    this.notificationsEnabled = false;
  }

  async enableNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') {
      this.saveStatus = 'Browser notifications are not supported on this device.';
      return;
    }

    const permission = await Notification.requestPermission();
    this.notificationsEnabled = permission === 'granted';
    this.saveStatus = this.notificationsEnabled
      ? 'Notifications enabled.'
      : 'Notifications were not granted.';
  }

  quickAdd(type: 'transaction' | 'budget' | 'contribution' | 'holding'): void {
    const targetMap: Record<typeof type, string> = {
      transaction: 'quick-transaction',
      budget: 'quick-budget',
      contribution: 'quick-contribution',
      holding: 'quick-holding'
    };
    const element = document.getElementById(targetMap[type]);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  setActivePage(page: 'dashboard' | 'walmart'): void {
    this.activePage = page;
  }

  addMainCryptoPreset(symbol: string): void {
    const normalized = symbol.toUpperCase();
    if (this.cryptoHoldings.some(holding => holding.symbol.toUpperCase() === normalized)) {
      return;
    }

    this.cryptoHoldings = [
      ...this.cryptoHoldings,
      {
        id: this.createId('crypto'),
        symbol: normalized,
        assetName: normalized,
        quantity: 0,
        averageCost: 0,
        currentPrice: this.cryptoPriceCache[normalized]?.price || 0,
        platform: 'Cold wallet / exchange'
      }
    ];
    void this.refreshCryptoPrices();
    this.markDirty();
  }

  addWalletTracker(): void {
    if (!this.newWalletTracker.label.trim() || !this.newWalletTracker.address.trim()) {
      return;
    }

    const unitMap: Record<WalletTracker['chain'], string> = {
      bitcoin: 'BTC',
      ethereum: 'ETH',
      litecoin: 'LTC',
      dogecoin: 'DOGE'
    };

    this.walletTrackers = [
      {
        id: this.createId('wallet'),
        label: this.newWalletTracker.label.trim(),
        chain: this.newWalletTracker.chain,
        address: this.newWalletTracker.address.trim(),
        balance: 0,
        unit: unitMap[this.newWalletTracker.chain],
        txCount: 0
      },
      ...this.walletTrackers
    ];

    this.newWalletTracker = {
      label: '',
      chain: 'bitcoin',
      address: ''
    };
    void this.syncWalletTrackers();
    this.markDirty();
  }

  removeWalletTracker(id: string): void {
    this.walletTrackers = this.walletTrackers.filter(item => item.id !== id);
    this.markDirty();
  }

  async syncWalletTrackers(): Promise<void> {
    if (!this.walletTrackers.length) {
      this.walletSyncStatus = 'Add a wallet to sync balances.';
      return;
    }

    this.isWalletSyncing = true;
    this.walletSyncStatus = 'Syncing cold-wallet balances and transactions...';

    try {
      const response = await firstValueFrom(this.http.post<{ ok: boolean; results: Array<{ id: string; balance: number; txCount: number; unit: string; syncedAt: string }>; message?: string }>(
        '/api/wallet-track',
        { wallets: this.walletTrackers }
      ));

      if (!response.ok) {
        this.walletSyncStatus = response.message || 'Wallet sync failed.';
        return;
      }

      const byId = new Map(response.results.map(item => [item.id, item]));
      this.walletTrackers = this.walletTrackers.map(wallet => {
        const match = byId.get(wallet.id);
        if (!match) {
          return wallet;
        }
        return {
          ...wallet,
          balance: match.balance,
          txCount: match.txCount,
          unit: match.unit,
          lastSyncedAt: match.syncedAt
        };
      });

      this.walletSyncStatus = `Wallet sync complete for ${response.results.length} wallet(s).`;
    } catch (error: unknown) {
      this.walletSyncStatus = 'Wallet sync failed. Check wallet addresses and network connectivity.';
      console.error(error);
    } finally {
      this.isWalletSyncing = false;
    }
  }

  addWalmartItem(): void {
    if (!this.newWalmartItem.query.trim()) {
      return;
    }

    const selected = this.selectedWalmartSuggestion;
    const queryText = this.newWalmartItem.query.trim();

    this.walmartList = [
      {
        id: this.createId('wmt'),
        query: queryText,
        currentPrice: selected?.price ?? null,
        currency: 'USD',
        productName: selected?.productName || '',
        productUrl: selected?.productUrl || ''
      },
      ...this.walmartList
    ];
    this.newWalmartItem.query = '';
    this.walmartSuggestions = [];
    this.selectedWalmartSuggestion = null;
    void this.refreshWalmartPrices();
    this.markDirty();
  }

  onWalmartQueryInput(value: string): void {
    this.newWalmartItem.query = value;
    this.selectedWalmartSuggestion = null;

    if (this.walmartSuggestTimeoutId) {
      clearTimeout(this.walmartSuggestTimeoutId);
      this.walmartSuggestTimeoutId = null;
    }

    const query = value.trim();
    if (query.length < 2) {
      this.walmartSuggestions = [];
      return;
    }

    this.walmartSuggestTimeoutId = setTimeout(() => {
      void this.fetchWalmartSuggestions(query);
    }, 250);
  }

  selectWalmartSuggestion(item: WalmartSuggestionItem): void {
    this.selectedWalmartSuggestion = item;
    this.newWalmartItem.query = item.productName;
    this.walmartSuggestions = [];
  }

  removeWalmartItem(id: string): void {
    this.walmartList = this.walmartList.filter(item => item.id !== id);
    this.markDirty();
  }

  async refreshWalmartPrices(): Promise<void> {
    if (!this.walmartList.length) {
      this.walmartStatus = 'Add an item to track Walmart pricing.';
      return;
    }

    this.isWalmartLoading = true;
    this.walmartStatus = 'Checking Walmart prices...';
    try {
      const response = await firstValueFrom(this.http.post<{ ok: boolean; items: WalmartListItem[]; message?: string }>('/api/walmart-prices', {
        items: this.walmartList
      }));

      if (!response.ok) {
        this.walmartStatus = response.message || 'Walmart price lookup failed.';
        return;
      }

      this.walmartList = response.items;
      this.walmartStatus = 'Walmart list refreshed.';
    } catch (error: unknown) {
      this.walmartStatus = 'Walmart lookup failed. Try again in a moment.';
      console.error(error);
    } finally {
      this.isWalmartLoading = false;
    }
  }

  private async fetchWalmartSuggestions(query: string): Promise<void> {
    this.isWalmartSuggesting = true;
    try {
      const response = await firstValueFrom(this.http.post<{ ok: boolean; items: WalmartSuggestionItem[]; message?: string }>(
        '/api/walmart-search',
        { query }
      ));

      if (!response.ok) {
        this.walmartSuggestions = [];
        return;
      }

      this.walmartSuggestions = response.items || [];
    } catch {
      this.walmartSuggestions = [];
    } finally {
      this.isWalmartSuggesting = false;
    }
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
        assetType: this.newIncomeStream.assetType,
        expectedAmount: Number(this.newIncomeStream.expectedAmount),
        receivedYtd: 0,
        nextPayout: this.newIncomeStream.nextPayout
      }
    ];

    this.newIncomeStream = {
      source: '',
      frequency: 'monthly',
      assetType: 'usd',
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
    void this.refreshCryptoPrices();
    this.markDirty();
  }

  addRothContribution(): void {
    const amount = Number(this.newRothContribution);
    if (amount <= 0) {
      return;
    }

    this.rothIra = {
      ...this.rothIra,
      currentBalance: this.rothIra.currentBalance + amount,
      contributionsYtd: this.rothIra.contributionsYtd + amount
    };
    this.newRothContribution = 0;
    this.markDirty();
  }

  addPassivePayoutEvent(): void {
    if (!this.newPayoutEvent.streamId || this.newPayoutEvent.amount <= 0) {
      return;
    }

    const stream = this.passiveIncomeStreams.find(item => item.id === this.newPayoutEvent.streamId);
    if (!stream) {
      return;
    }

    this.passivePayoutEvents = [
      {
        id: this.createId('pay'),
        streamId: this.newPayoutEvent.streamId,
        amount: Number(this.newPayoutEvent.amount),
        assetType: this.newPayoutEvent.assetType,
        paidAt: this.newPayoutEvent.paidAt,
        note: this.newPayoutEvent.note?.trim() || undefined
      },
      ...this.passivePayoutEvents
    ];

    const usdAmount = this.newPayoutEvent.assetType === 'btc'
      ? Number(this.newPayoutEvent.amount) * this.btcUsdPrice
      : Number(this.newPayoutEvent.amount);

    this.passiveIncomeStreams = this.passiveIncomeStreams.map(item =>
      item.id === stream.id
        ? { ...item, receivedYtd: item.receivedYtd + usdAmount }
        : item
    );

    this.newPayoutEvent = {
      streamId: this.passiveIncomeStreams[0]?.id || '',
      amount: 0,
      assetType: 'usd',
      paidAt: this.today,
      note: ''
    };
    this.markDirty();
  }

  removePayoutEvent(id: string): void {
    this.passivePayoutEvents = this.passivePayoutEvents.filter(item => item.id !== id);
    this.markDirty();
  }

  updateRothIraSettings(): void {
    this.rothIra = {
      currentBalance: Number(this.rothIra.currentBalance) || 0,
      yearlyContribution: Number(this.rothIra.yearlyContribution) || 0,
      yearlyLimit: Number(this.rothIra.yearlyLimit) || 7000,
      employerMatchPercent: Number(this.rothIra.employerMatchPercent) || 0,
      expectedAnnualReturn: Number(this.rothIra.expectedAnnualReturn) || 0,
      contributionsYtd: Number(this.rothIra.contributionsYtd) || 0
    };
    this.markDirty();
  }

  addAccount(): void {
    if (!this.newAccount.name.trim() || !this.newAccount.institution.trim()) {
      return;
    }

    this.accounts = [
      ...this.accounts,
      {
        id: this.createId('acc'),
        name: this.newAccount.name.trim(),
        institution: this.newAccount.institution.trim(),
        type: this.newAccount.type,
        last4: this.newAccount.last4.trim() || '0000',
        balance: Number(this.newAccount.balance),
        syncStatus: 'manual'
      }
    ];
    this.newAccount = { name: '', institution: '', type: 'checking', last4: '', balance: 0 };
    this.markDirty();
  }

  addSavingsGoal(): void {
    if (!this.newSavingsGoal.name.trim() || this.newSavingsGoal.targetAmount <= 0) {
      return;
    }

    this.savingsGoals = [
      ...this.savingsGoals,
      {
        id: this.createId('goal'),
        name: this.newSavingsGoal.name.trim(),
        targetAmount: Number(this.newSavingsGoal.targetAmount),
        currentAmount: Number(this.newSavingsGoal.currentAmount),
        targetDate: this.newSavingsGoal.targetDate,
        startDate: this.today
      }
    ];
    this.newSavingsGoal = { name: '', targetAmount: 0, currentAmount: 0, targetDate: this.today };
    this.markDirty();
  }

  removeTransaction(id: string): void {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.markDirty();
  }

  removeBudget(id: string): void {
    this.budgets = this.budgets.filter(b => b.id !== id);
    this.markDirty();
  }

  removeAutoPayment(id: string): void {
    this.autoPayments = this.autoPayments.filter(p => p.id !== id);
    this.markDirty();
  }

  removeIncomeStream(id: string): void {
    this.passiveIncomeStreams = this.passiveIncomeStreams.filter(s => s.id !== id);
    this.passivePayoutEvents = this.passivePayoutEvents.filter(event => event.streamId !== id);
    this.markDirty();
  }

  removeCryptoHolding(id: string): void {
    this.cryptoHoldings = this.cryptoHoldings.filter(h => h.id !== id);
    this.markDirty();
  }

  removeAccount(id: string): void {
    this.accounts = this.accounts.filter(a => a.id !== id);
    this.markDirty();
  }

  removeSavingsGoal(id: string): void {
    this.savingsGoals = this.savingsGoals.filter(g => g.id !== id);
    this.markDirty();
  }

  clearAllData(): void {
    if (!confirm('Clear ALL data and reset to empty? This will immediately overwrite the saved state on the server.')) {
      return;
    }
    this.accounts = [];
    this.budgets = [];
    this.transactions = [];
    this.autoPayments = [];
    this.passiveIncomeStreams = [];
    this.passivePayoutEvents = [];
    this.cryptoHoldings = [];
    this.cryptoPriceCache = {};
    this.cryptoHistoryPoints = [];
    this.walletTrackers = [];
    this.walmartList = [];
    this.savingsGoals = [];
    this.rothIra = {
      currentBalance: 0,
      yearlyContribution: 0,
      yearlyLimit: 7000,
      employerMatchPercent: 0,
      expectedAnnualReturn: 7,
      contributionsYtd: 0
    };
    void this.saveState();
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
        return { ...provider, status: 'connected' };
      }

      return provider;
    });

    this.markDirty();
  }

  accountTypeIcon(type: string): string {
    const map: Record<string, string> = {
      'checking': '🏧',
      'savings': '🏛️',
      'credit-card': '💳',
      'investment': '📈',
    };
    return map[type] || '🏦';
  }

  categoryIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('hous') || n.includes('rent') || n.includes('mortg')) return '🏠';
    if (n.includes('food') || n.includes('grocer') || n.includes('dine')) return '🍔';
    if (n.includes('transport') || n.includes('gas') || n.includes('car')) return '🚗';
    if (n.includes('util') || n.includes('electric') || n.includes('internet')) return '💡';
    if (n.includes('health') || n.includes('medical') || n.includes('pharma')) return '🏥';
    if (n.includes('entertain') || n.includes('subscript') || n.includes('stream')) return '🎬';
    if (n.includes('invest') || n.includes('stock') || n.includes('etf')) return '📈';
    if (n.includes('debt') || n.includes('loan') || n.includes('credit')) return '💳';
    if (n.includes('insur')) return '🛡️';
    if (n.includes('salar') || n.includes('income') || n.includes('wage')) return '💵';
    if (n.includes('travel') || n.includes('vacation') || n.includes('hotel')) return '✈️';
    if (n.includes('cloth') || n.includes('shopping')) return '🛍️';
    if (n.includes('education') || n.includes('school') || n.includes('course')) return '📚';
    if (n.includes('roth') || n.includes('ira') || n.includes('retirement')) return '🏛️';
    return '📂';
  }

  getPassiveStreamUsdPerYear(stream: PassiveIncomeStream): number {
    const yearlyAmount = this.getCadenceFactorPerYear(stream.frequency) * stream.expectedAmount;
    if (stream.assetType === 'btc') {
      return yearlyAmount * this.btcUsdPrice;
    }
    return yearlyAmount;
  }

  getPassiveStreamUsdPerSecond(stream: PassiveIncomeStream): number {
    return this.getPassiveStreamUsdPerYear(stream) / (365 * 24 * 60 * 60);
  }

  getPassiveStreamUnitLabel(stream: PassiveIncomeStream): string {
    return stream.assetType === 'btc' ? 'BTC' : '$';
  }

  async refreshCryptoPrices(): Promise<void> {
    const symbols = Array.from(new Set(this.cryptoHoldings.map(holding => holding.symbol.toUpperCase())));
    if (!symbols.length) {
      this.cryptoPriceStatus = 'Add holdings to enable live crypto pricing.';
      return;
    }

    const ids = symbols
      .map(symbol => this.symbolToCoinId[symbol])
      .filter((id): id is string => Boolean(id));

    if (!ids.length) {
      this.cryptoPriceStatus = 'No supported symbols yet for live sync. Try BTC, ETH, SOL, ADA, XRP, DOGE.';
      return;
    }

    this.isCryptoSyncing = true;
    this.cryptoPriceStatus = 'Syncing live crypto prices...';

    try {
      const endpoint = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
      const priceMap = await firstValueFrom(this.http.get<Record<string, { usd: number }>>(endpoint));

      this.cryptoHoldings = this.cryptoHoldings.map(holding => {
        const coinId = this.symbolToCoinId[holding.symbol.toUpperCase()];
        const live = coinId ? priceMap[coinId]?.usd : null;
        if (!live || Number.isNaN(live)) {
          return holding;
        }
        this.cryptoPriceCache[holding.symbol.toUpperCase()] = {
          price: live,
          source: 'coingecko',
          fetchedAt: new Date().toISOString()
        };
        return { ...holding, currentPrice: live };
      });

      this.lastCryptoSyncedAt = new Date().toISOString();
      this.cryptoPriceStatus = `Live prices updated at ${new Date(this.lastCryptoSyncedAt).toLocaleTimeString()}.`;
    } catch (error: unknown) {
      await this.refreshCryptoPricesWithFallback(symbols);
      console.error(error);
    } finally {
      this.isCryptoSyncing = false;
    }
    await this.loadCryptoHistory(this.cryptoHistoryRange);
  }

  async loadCryptoHistory(range: '7d' | '30d' | '1y'): Promise<void> {
    this.cryptoHistoryRange = range;
    const symbol = this.selectedChartSymbol;
    const coinId = this.symbolToCoinId[symbol];
    if (!coinId) {
      this.cryptoHistoryPoints = [];
      this.cryptoHistoryStatus = `No historical source mapped for ${symbol}.`;
      return;
    }

    const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
    this.isCryptoHistoryLoading = true;
    this.cryptoHistoryStatus = `Loading ${range} history for ${symbol}...`;

    try {
      const endpoint = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const response = await firstValueFrom(this.http.get<{ prices: [number, number][] }>(endpoint));
      const points = (response.prices || []).map(([timestamp, price]) => ({
        timestamp,
        price,
        label: new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }));

      this.cryptoHistoryPoints = points;
      this.cryptoHistoryStatus = `${symbol} ${range} history loaded from CoinGecko.`;
    } catch (error: unknown) {
      await this.loadCryptoHistoryWithFallback(symbol, range);
      console.error(error);
    } finally {
      this.isCryptoHistoryLoading = false;
    }
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
      await this.refreshCryptoPrices();
      await this.loadCryptoHistory(this.cryptoHistoryRange);
      await this.syncWalletTrackers();
      await this.refreshWalmartPrices();
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
      passivePayoutEvents: this.passivePayoutEvents,
      cryptoHoldings: this.cryptoHoldings,
      cryptoPriceCache: this.cryptoPriceCache,
      walletTrackers: this.walletTrackers,
      walmartList: this.walmartList,
      savingsGoals: this.savingsGoals,
      rothIra: this.rothIra
    };
  }

  private applyStateModel(model: FinanceStateModel): void {
    this.accounts = model.accounts || [];
    this.budgets = model.budgets || [];
    this.transactions = model.transactions || [];
    this.autoPayments = model.autoPayments || [];
    this.passiveIncomeStreams = (model.passiveIncomeStreams || []).map(stream => ({
      ...stream,
      frequency: stream.frequency || 'monthly',
      assetType: stream.assetType || 'usd'
    }));
    this.passivePayoutEvents = model.passivePayoutEvents || [];
    this.cryptoHoldings = model.cryptoHoldings || [];
    this.cryptoPriceCache = model.cryptoPriceCache || {};
    this.walletTrackers = model.walletTrackers || [];
    this.walmartList = model.walmartList || [];
    this.savingsGoals = (model.savingsGoals || []).map(goal => ({
      ...goal,
      startDate: goal.startDate || this.today
    }));
    this.rothIra = {
      currentBalance: model.rothIra?.currentBalance || 0,
      yearlyContribution: model.rothIra?.yearlyContribution || 0,
      yearlyLimit: model.rothIra?.yearlyLimit || 7000,
      employerMatchPercent: model.rothIra?.employerMatchPercent || 0,
      expectedAnnualReturn: model.rothIra?.expectedAnnualReturn || 7,
      contributionsYtd: model.rothIra?.contributionsYtd || 0
    };
    this.newPayoutEvent.streamId = this.passiveIncomeStreams[0]?.id || '';
  }

  streamNameById(streamId: string): string {
    return this.passiveIncomeStreams.find(item => item.id === streamId)?.source || 'Unknown stream';
  }

  private async refreshCryptoPricesWithFallback(symbols: string[]): Promise<void> {
    const updates: Record<string, number> = {};

    for (const symbol of symbols) {
      try {
        const endpoint = `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`;
        const response = await firstValueFrom(this.http.get<{ data?: { amount?: string } }>(endpoint));
        const parsed = Number(response?.data?.amount || 0);
        if (parsed > 0) {
          updates[symbol] = parsed;
          this.cryptoPriceCache[symbol] = {
            price: parsed,
            source: 'coinbase',
            fetchedAt: new Date().toISOString()
          };
        }
      } catch {
        const cached = this.cryptoPriceCache[symbol]?.price;
        if (cached) {
          updates[symbol] = cached;
        }
      }
    }

    this.cryptoHoldings = this.cryptoHoldings.map(holding => {
      const symbol = holding.symbol.toUpperCase();
      const fallback = updates[symbol];
      if (!fallback) {
        return holding;
      }
      return { ...holding, currentPrice: fallback };
    });

    const hitCount = Object.keys(updates).length;
    this.cryptoPriceStatus = hitCount
      ? `Primary source limited. Updated ${hitCount} symbols via fallback/cache.`
      : 'Price refresh failed across providers. Showing last known prices.';
  }

  private async loadCryptoHistoryWithFallback(symbol: string, range: '7d' | '30d' | '1y'): Promise<void> {
    const granularity = range === '7d' ? 3600 : 86400;
    const end = Math.floor(Date.now() / 1000);
    const seconds = range === '7d' ? 7 * 86400 : range === '30d' ? 30 * 86400 : 365 * 86400;
    const start = end - seconds;
    const endpoint = `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=${granularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;

    try {
      const candles = await firstValueFrom(this.http.get<number[][]>(endpoint));
      const points = (candles || [])
        .map(candle => {
          const timestamp = candle[0] * 1000;
          const close = candle[4];
          return {
            timestamp,
            price: close,
            label: new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      this.cryptoHistoryPoints = points;
      this.cryptoHistoryStatus = `${symbol} ${range} history loaded from fallback provider.`;
    } catch {
      this.cryptoHistoryPoints = [];
      this.cryptoHistoryStatus = `Unable to load ${symbol} historical chart from providers.`;
    }
  }

  private runNotificationChecks(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    if (this.rothIra.contributionsYtd > this.rothIra.yearlyLimit) {
      this.dispatchNotification('roth-limit', 'Roth IRA limit alert', 'Your logged contributions appear above the annual limit.');
    }

    if (this.monthsOfRunway > 0 && this.monthsOfRunway < 3) {
      this.dispatchNotification('runway', 'Runway warning', `Financial runway is ${this.monthsOfRunway.toFixed(1)} months.`);
    }

    const dueSoon = this.upcomingAutoPayments.find(item => item.dueDay <= new Date().getDate() + 1);
    if (dueSoon) {
      this.dispatchNotification('autopay', 'Auto-payment due soon', `${dueSoon.name} is due around day ${dueSoon.dueDay}.`);
    }
  }

  private dispatchNotification(key: string, title: string, body: string): void {
    const now = Date.now();
    const last = this.lastNotificationAt[key] || 0;
    if (now - last < 1000 * 60 * 60 * 6) {
      return;
    }
    this.lastNotificationAt[key] = now;
    new Notification(title, { body });
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / 86400000);
  }

  private getCadenceFactorPerYear(frequency: PassiveIncomeStream['frequency']): number {
    if (frequency === 'secondly') {
      return 365 * 24 * 60 * 60;
    }
    if (frequency === 'daily') {
      return 365;
    }
    if (frequency === 'weekly') {
      return 52;
    }
    if (frequency === 'monthly') {
      return 12;
    }
    if (frequency === 'quarterly') {
      return 4;
    }
    return 1;
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