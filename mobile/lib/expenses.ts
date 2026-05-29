import type { Expense, SplitResult, Settlement } from '@/types';

export function splitExpenses(expenses: Expense[], memberIds: string[]): SplitResult {
  const balances: Record<string, number> = {};

  for (const memberId of memberIds) {
    balances[memberId] = 0;
  }

  for (const expense of expenses) {
    if (!expense.split) continue;

    const eurAmount = expense.amount_eur ?? expense.amount;
    const share = eurAmount / memberIds.length;

    balances[expense.paid_by] = (balances[expense.paid_by] ?? 0) + eurAmount;

    for (const memberId of memberIds) {
      balances[memberId] = (balances[memberId] ?? 0) - share;
    }
  }

  const settlements: Settlement[] = [];
  const [userA, userB] = memberIds;

  if (!userA || !userB) {
    return { settlements: [], is_even: true };
  }

  const netA = Math.round((balances[userA] ?? 0) * 100) / 100;

  if (Math.abs(netA) < 0.01) {
    return { settlements: [], is_even: true };
  }

  if (netA < 0) {
    settlements.push({
      from_user_id: userA,
      to_user_id: userB,
      amount_eur: Math.abs(netA),
    });
  } else {
    settlements.push({
      from_user_id: userB,
      to_user_id: userA,
      amount_eur: netA,
    });
  }

  return { settlements, is_even: false };
}
