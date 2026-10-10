import type { Expense, SplitResult, Settlement } from '@/types';

/**
 * Same rules as src/lib/expenses.ts on the web (T-3.2), so both apps show the
 * same balance: arithmetic in integer cents, and a foreign-currency expense
 * without amount_eur ("da convertire") is left out instead of being counted
 * as if it were in EUR.
 */

export function eurCents(expense: Pick<Expense, 'amount' | 'amount_eur' | 'currency'>): number | null {
  if (expense.amount_eur !== null && expense.amount_eur !== undefined) return Math.round(Number(expense.amount_eur) * 100);
  if ((expense.currency ?? 'EUR').toUpperCase() === 'EUR') return Math.round(Number(expense.amount) * 100);
  return null;
}

/** Total in EUR of the converted expenses, and how many still need a rate. */
export function sumEur(expenses: Expense[]): { total: number; unconverted: number } {
  let cents = 0;
  let unconverted = 0;
  for (const expense of expenses) {
    const value = eurCents(expense);
    if (value === null) unconverted += 1;
    else cents += value;
  }
  return { total: cents / 100, unconverted };
}

export function splitExpenses(expenses: Expense[], memberIds: string[]): SplitResult {
  const [userA, userB] = memberIds;
  if (!userA || !userB) {
    return { settlements: [], is_even: false };
  }

  // Net balance of A in cents: positive = A is owed money; the odd cent stays with the payer.
  let netA = 0;
  for (const expense of expenses) {
    if (!expense.split) continue;
    const cents = eurCents(expense);
    if (cents === null) continue;
    const otherShare = Math.floor(cents / 2);
    if (expense.paid_by === userA) netA += otherShare;
    else if (expense.paid_by === userB) netA -= otherShare;
  }

  if (netA === 0) {
    return { settlements: [], is_even: true };
  }

  const settlement: Settlement = netA < 0
    ? { from_user_id: userA, to_user_id: userB, amount_eur: -netA / 100 }
    : { from_user_id: userB, to_user_id: userA, amount_eur: netA / 100 };

  return { settlements: [settlement], is_even: false };
}
