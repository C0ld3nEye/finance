import { pb } from '../config/pocketbase';

export const migrateMemberId = async (householdId, oldId, newId) => {
  if (!householdId || !oldId || !newId || oldId === newId) return;
  const f = `householdId = "${householdId}"`;

  // 1. Migrer les Charges Fixes
  const charges = await pb.collection('charges').getFullList({ filter: f });
  for (const charge of charges) {
    if (charge.distribution && charge.distribution[oldId] !== undefined) {
      const newDist = { ...charge.distribution };
      newDist[newId] = charge.distribution[oldId];
      delete newDist[oldId];
      await pb.collection('charges').update(charge.id, { distribution: newDist });
    }
  }

  // 2. Migrer les Dépenses
  const expenses = await pb.collection('expenses').getFullList({ filter: f });
  for (const expense of expenses) {
    if (expense.paidBy === oldId) {
      await pb.collection('expenses').update(expense.id, { paidBy: newId });
    }
  }

  // 3. Migrer les Salaires
  const salaries = await pb.collection('salaries').getFullList({ filter: f });
  for (const sal of salaries) {
    if (sal.salaries && sal.salaries[oldId] !== undefined) {
      const newSals = { ...sal.salaries };
      newSals[newId] = sal.salaries[oldId];
      delete newSals[oldId];
      await pb.collection('salaries').update(sal.id, { salaries: newSals });
    }
  }
};
