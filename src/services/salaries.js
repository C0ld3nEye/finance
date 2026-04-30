import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const updateMonthlySalaries = async (householdId, year, month, salaries) => {
  const id = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  await setDoc(doc(db, 'households', householdId, 'salaries', id), {
    salaries, year, month, updatedAt: new Date().toISOString(),
  });
};

/**
 * Trouve les salaires d'un mois donné dans le tableau retourné par useHouseholdData.
 */
export const findSalariesForMonth = (allSalaries, year, month) => {
  const id = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  return allSalaries.find(s => s.id === id) || null;
};

/**
 * Lecture directe one-shot — utilisé par Salaries.jsx uniquement.
 */
export const getMonthlySalaries = async (householdId, year, month) => {
  if (!householdId) return null;
  const id = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const snap = await getDoc(doc(db, 'households', householdId, 'salaries', id));
  return snap.exists() ? snap.data() : null;
};
