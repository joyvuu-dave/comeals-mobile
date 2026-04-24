export type AdminUser = {
  id: number;
  email: string;
  community_id: number | null;
  superuser: boolean;
};

export type LoginResponse = {
  token: string;
  admin_user: AdminUser;
};

export type ReconciliationSummary = {
  id: number;
  date: string;
  end_date: string;
  settled_at: string | null;
  meal_count: number;
  balance_count: number;
  paid_count: number;
  unpaid_count: number;
  collect_count: number;
  payout_count: number;
};

export type BalanceSide = 'owes' | 'owed';

export type ReconciliationBalance = {
  id: number;
  resident_id: number;
  resident_name: string;
  unit_id: number;
  unit_name: string;
  amount: string;
  side: BalanceSide;
  paid_at: string | null;
};

export type UnitRollup = {
  unit_id: number;
  unit_name: string;
  collect_amount: string;
  collect_count: number;
  collect_paid_count: number;
  collect_unpaid_count: number;
  payout_amount: string;
  payout_count: number;
  payout_paid_count: number;
  payout_unpaid_count: number;
};

export type ReconciliationDetail = {
  reconciliation: ReconciliationSummary;
  balances: ReconciliationBalance[];
  units: UnitRollup[];
};

export type ReconciliationsResponse = {
  reconciliations: ReconciliationSummary[];
};
