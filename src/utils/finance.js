/**
 * Calcule la répartition d'un montant entre les membres du foyer.
 *
 * @param {number} amount           - Montant total à répartir.
 * @param {string} distType         - Type de répartition ('50_50', 'prorata', 'custom', 'custom_amount', 'hybrid').
 * @param {Array}  members          - Tableau des membres [{ id, name, salary }].
 * @param {Object} salaries         - Salaires mensuels { [memberId]: number } (prioritaire sur member.salary).
 * @param {Object} customPercentages- Pourcentages personnalisés { [memberId]: number }.
 * @param {Object} customAmounts    - Montants fixes personnalisés { [memberId]: number }.
 * @param {Array}  allSalaries      - (optionnel) Tous les salaires mensuels Firebase [{ id: 'YYYY-MM', salaries: {...} }].
 *                                    Si fourni avec refDate, écrase le paramètre salaries pour le bon mois.
 * @param {Date|string} refDate     - (optionnel) Date de référence pour retrouver le bon mois dans allSalaries.
 * @returns {Object} Répartition { [memberId]: number }
 */
export const calculateDistribution = (
  amount,
  distType,
  members,
  salaries = {},
  customPercentages = {},
  customAmounts = {},
  allSalaries = null,
  refDate = null
) => {
  const numAmount = Number(amount);
  if (!members || members.length === 0) return {};

  // Si allSalaries + refDate fournis, on résout les salaires du bon mois (usage Dashboard/Debts)
  let resolvedSalaries = salaries;
  if (allSalaries && refDate) {
    const d = new Date(refDate);
    const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthData = allSalaries.find(s => s.id === monthKey);
    if (monthData?.salaries) resolvedSalaries = monthData.salaries;
  }

  // Résoudre le salaire d'un membre : priorité aux salaires mensuels, sinon au salaire statique du profil
  const getSalary = (member) =>
    resolvedSalaries[member.id] !== undefined
      ? Number(resolvedSalaries[member.id])
      : Number(member.salary || 0);

  if (distType === '50_50') {
    const share = numAmount / members.length;
    return Object.fromEntries(members.map((m) => [m.id, share]));
  }

  if (distType === 'prorata') {
    const totalSal = members.reduce((acc, m) => acc + getSalary(m), 0);
    if (totalSal === 0) {
      const share = numAmount / members.length;
      return Object.fromEntries(members.map((m) => [m.id, share]));
    }
    return Object.fromEntries(
      members.map((m) => [m.id, numAmount * (getSalary(m) / totalSal)])
    );
  }

  if (distType === 'custom') {
    return Object.fromEntries(
      members.map((m) => [m.id, (numAmount * (customPercentages[m.id] || 0)) / 100])
    );
  }

  if (distType === 'custom_amount') {
    return Object.fromEntries(
      members.map((m) => [m.id, Number(customAmounts[m.id] || 0)])
    );
  }

  if (distType === 'hybrid') {
    const fixedSum = members.reduce((acc, m) => acc + Number(customAmounts[m.id] || 0), 0);
    const remainder = Math.max(0, numAmount - fixedSum);
    const totalSal = members.reduce((acc, m) => acc + getSalary(m), 0);
    return Object.fromEntries(
      members.map((m) => {
        const prorataShare =
          totalSal > 0
            ? (remainder * getSalary(m)) / totalSal
            : remainder / members.length;
        return [m.id, prorataShare + Number(customAmounts[m.id] || 0)];
      })
    );
  }

  return {};
};

/**
 * Formatte un montant en euros.
 * @param {number} value
 * @returns {string}
 */
export const formatEuro = (value) => `${Number(value || 0).toFixed(2)} €`;

/**
 * Retourne le montant mensuel effectif d'une charge.
 * Pour les charges annuelles lissées, divise par 12.
 * Pour les charges mensuelles (ou sans fréquence), retourne le montant tel quel.
 *
 * @param {{ amount: number, frequency?: string, annualAmount?: number }} charge
 * @returns {number}
 */
export const getMonthlyAmount = (charge) => {
  if (charge.frequency === 'annual') {
    // annualAmount est le montant brut annuel, amount est déjà le 1/12 calculé au formulaire
    // On s'assure de toujours utiliser amount (déjà lissé) pour les calculs mensuels
    return Number(charge.amount || 0);
  }
  return Number(charge.amount || 0);
};
