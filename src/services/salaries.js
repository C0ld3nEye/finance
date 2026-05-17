import { pb } from '../config/pocketbase';

export const updateMonthlySalaries = async (householdId, year, month, salaries) => {
  const salaryId = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const data = { salaries, year, month, householdId, salaryId, updatedAt: new Date().toISOString() };

  try {
    const existing = await pb.collection('salaries').getFirstListItem(
      `householdId = "${householdId}" && salaryId = "${salaryId}"`
    );
    await pb.collection('salaries').update(existing.id, data);
  } catch {
    await pb.collection('salaries').create(data);
  }
};

/**
 * Trouve les salaires d'un mois donné dans le tableau retourné par useHouseholdData.
 */
export const findSalariesForMonth = (allSalaries, year, month) => {
  const salaryId = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  return allSalaries.find(s => s.salaryId === salaryId) || null;
};

/**
 * Lecture directe one-shot — utilisé par Salaries.jsx uniquement.
 */
export const getMonthlySalaries = async (householdId, year, month) => {
  if (!householdId) return null;
  const salaryId = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  try {
    return await pb.collection('salaries').getFirstListItem(
      `householdId = "${householdId}" && salaryId = "${salaryId}"`
    );
  } catch {
    return null;
  }
};
