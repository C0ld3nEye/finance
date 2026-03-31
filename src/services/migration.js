import { db } from '../config/firebase';
import { collection, getDocs, updateDoc, doc, deleteField } from 'firebase/firestore';

export const migrateMemberId = async (householdId, oldId, newId) => {
  if (!householdId || !oldId || !newId || oldId === newId) return;

  // 1. Migrer les Charges Fixes
  const chargesRef = collection(db, 'households', householdId, 'charges');
  const chargesSnap = await getDocs(chargesRef);
  for (const cDoc of chargesSnap.docs) {
    const data = cDoc.data();
    if (data.distribution && data.distribution[oldId] !== undefined) {
      const newDist = { ...data.distribution };
      newDist[newId] = data.distribution[oldId];
      delete newDist[oldId];
      await updateDoc(cDoc.ref, { distribution: newDist });
    }
  }

  // 2. Migrer les Dépenses
  const expensesRef = collection(db, 'households', householdId, 'expenses');
  const expensesSnap = await getDocs(expensesRef);
  for (const eDoc of expensesSnap.docs) {
    const data = eDoc.data();
    if (data.paidBy === oldId) {
      await updateDoc(eDoc.ref, { paidBy: newId });
    }
  }

  // 3. Migrer les Salaires
  const salariesRef = collection(db, 'households', householdId, 'salaries');
  const salariesSnap = await getDocs(salariesRef);
  for (const sDoc of salariesSnap.docs) {
    const data = sDoc.data();
    if (data.salaries && data.salaries[oldId] !== undefined) {
      const newSals = { ...data.salaries };
      newSals[newId] = data.salaries[oldId];
      delete newSals[oldId];
      await updateDoc(sDoc.ref, { salaries: newSals });
    }
  }
};
