import { calculateDistribution } from './finance';
import { isChargeActiveInMonth, isInAccountingMonth } from './monthUtils';

/**
 * Calcule l'état des dettes cumulées pour tous les membres du foyer.
 * 
 * @param {Array} members - Liste des membres [{id, name, ...}]
 * @param {Array} accounts - Liste des comptes [{id, name, visibility, ownerId}]
 * @param {Array} expenses - Liste des dépenses
 * @param {Array} charges - Liste des charges
 * @param {Array} settlements - Liste des règlements
 * @param {Array} salaries - Liste des salaires mensuels
 * @param {number} startDay - Jour de début du mois comptable
 * @param {number} selectedYear - Année de la période cible
 * @param {number} selectedMonth - Mois de la période cible (0-indexed)
 */
export const calculateHouseholdDebts = (
  members,
  accounts,
  expenses,
  charges,
  settlements,
  salaries,
  startDay,
  selectedYear,
  selectedMonth
) => {
  if (!members || !Array.isArray(members) || members.length < 2) return null;

  const currentMonthKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;

  const toCommon = {};
  const toPartners = {};
  const detailsCommon = {};
  const detailsPartners = {};

  members.forEach(m => {
    toCommon[m.id] = {};
    detailsCommon[m.id] = {};
    accounts.filter(a => a.visibility === 'shared').forEach(a => {
      toCommon[m.id][a.id] = { current: 0, arrears: 0 };
      detailsCommon[m.id][a.id] = [];
    });
    toPartners[m.id] = {};
    detailsPartners[m.id] = {};
    members.forEach(m2 => {
      if (m.id !== m2.id) {
        toPartners[m.id][m2.id] = { current: 0, arrears: 0 };
        detailsPartners[m.id][m2.id] = [];
      }
    });
  });

  const getShares = (item, refDate) =>
    calculateDistribution(item.amount, item.distributionType || '50_50', members, {}, item.customPercentages, item.customAmounts, salaries, refDate);

  // Déterminer la date de début (plus ancienne dépense ou charge)
  const allDates = [
    ...expenses.map(e => new Date(e.date || e.createdAt)),
    ...charges.map(c => c.validFrom ? new Date(c.validFrom + '-01') : null).filter(Boolean),
  ].filter(d => d && !isNaN(d));

  const fallback = new Date(); fallback.setMonth(fallback.getMonth() - 24); fallback.setDate(1);
  const earliest = allDates.length > 0 ? new Date(Math.min(...allDates)) : fallback;
  const endDate = new Date(selectedYear, selectedMonth, 1);

  // Parcourir chaque mois jusqu'à la période sélectionnée
  let cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  while (cur <= endDate) {
    const y = cur.getFullYear(); const m = cur.getMonth();
    const mKey = `${y}-${(m + 1).toString().padStart(2, '0')}`;
    const isCurrent = mKey === currentMonthKey;
    const refDate = new Date(y, m, 15);

    // Charges
    charges.filter(c => isChargeActiveInMonth(c, y, m)).forEach(c => {
      const shares = getShares(c, refDate);
      const acc = accounts.find(a => a.id === c.accountId);
      Object.keys(shares).forEach(mId => {
        const share = shares[mId];
        if (share <= 0) return;
        if (acc?.visibility === 'shared') {
          if (toCommon[mId]?.[acc.id]) {
            isCurrent ? (toCommon[mId][acc.id].current += share) : (toCommon[mId][acc.id].arrears += share);
            detailsCommon[mId][acc.id].push({ name: c.name || 'Charge', share, totalAmount: c.amount, month: mKey, type: 'charge', distributionType: c.distributionType });
          }
        } else if (acc?.ownerId && acc.ownerId !== mId && toPartners[mId]?.[acc.ownerId]) {
          isCurrent ? (toPartners[mId][acc.ownerId].current += share) : (toPartners[mId][acc.ownerId].arrears += share);
          detailsPartners[mId][acc.ownerId].push({ name: c.name || 'Charge', share, totalAmount: c.amount, month: mKey, type: 'charge', distributionType: c.distributionType });
        }
      });
    });

    // Dépenses
    expenses.filter(e => isInAccountingMonth(e.date || e.createdAt, y, m, startDay)).forEach(e => {
      const shares = getShares(e, refDate);
      const acc = accounts.find(a => a.id === e.accountId);
      Object.keys(shares).forEach(mId => {
        const share = shares[mId];
        if (share <= 0) return;
        if (acc?.visibility === 'shared') {
          if (toCommon[mId]?.[acc.id]) {
            isCurrent ? (toCommon[mId][acc.id].current += share) : (toCommon[mId][acc.id].arrears += share);
            detailsCommon[mId][acc.id].push({ name: e.description || 'Dépense', share, totalAmount: e.amount, month: mKey, type: 'expense', distributionType: e.distributionType });
          }
        } else if (acc?.ownerId && acc.ownerId !== mId && toPartners[mId]?.[acc.ownerId]) {
          isCurrent ? (toPartners[mId][acc.ownerId].current += share) : (toPartners[mId][acc.ownerId].arrears += share);
          detailsPartners[mId][acc.ownerId].push({ name: e.description || 'Dépense', share, totalAmount: e.amount, month: mKey, type: 'expense', distributionType: e.distributionType });
        }
      });
    });

    cur.setMonth(cur.getMonth() + 1);
  }

  const cutoff = new Date(selectedYear, selectedMonth + 1, 1);
  const filteredSettlements = settlements.filter(s => new Date(s.year, s.month, 1) < cutoff);
  const monthSettlements = settlements.filter(s => s.year === selectedYear && s.month === selectedMonth);

  return { toCommon, toPartners, detailsCommon, detailsPartners, filteredSettlements, monthSettlements };
};
