export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  created_at: string;
}

export type TransactionType = 'credit' | 'payment';

export interface Transaction {
  id: string;
  customer_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  note: string;
  transaction_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface TransactionWithBalance extends Transaction {
  balance: number;
}

export interface DashboardStats {
  totalCustomers: number;
  totalDue: number;
  todayCredit: number;
  todayPayment: number;
  topDebtors: (Customer & { balance: number })[];
  overdue: (Customer & { balance: number; isOverdue: boolean } )[];
  last7Days: { date: string; credit: number; payment: number }[];
}
