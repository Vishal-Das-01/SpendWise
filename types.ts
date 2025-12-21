export type Currency = 'USD' | 'EUR' | 'CAD' | 'GBP' | 'AUD' | 'JPY' | 'INR' | 'PKR';

export interface Transaction {
  id: string;
  amount: number;
  currency: Currency;
  category: string;
  date: string;
  description: string;
  merchant?: string;
  type: 'expense' | 'income';
  notes?: string;
}

export interface Budget {
  category: string;
  limit: number;
  spent: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
}

export interface UserSettings {
  baseCurrency: Currency;
  homeCurrency: Currency;
  exchangeRate: number; // base to home
}

export interface Category {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface QuickShortcut {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
}

export type ViewState = 'dashboard' | 'transactions' | 'budget' | 'chat' | 'settings' | 'tips';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}