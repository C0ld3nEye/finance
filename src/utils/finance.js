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
    return Number(charge.amount || 0);
  }
  return Number(charge.amount || 0);
};

const MONTH_NAMES_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/**
 * Convertit un nom de mois français en index 0-based.
 * @param {string} monthName - Ex: "Octobre"
 * @returns {number} Index 0-based, ou -1 si non trouvé.
 */
export const frMonthToIndex = (monthName) => MONTH_NAMES_FR.indexOf(monthName);

/**
 * Calcule l'état de provision d'une charge annuelle pour un mois donné.
 *
 * Principe : chaque mois, charge.amount (= annualAmount / 12) est mis de côté.
 * À la fin du mois d'échéance, la totalité du montant annuel doit être provisionnée.
 *
 * @param {Object} charge - { amount, annualAmount, annualDueDate, validFrom }
 * @param {number} currentYear
 * @param {number} currentMonth - Index 0-based
 * @returns {{
 *   provisioned: number,
 *   total: number,
 *   remaining: number,
 *   progressPct: number,
 *   dueMonthIndex: number,
 *   monthsUntilDue: number,
 *   isDueThisMonth: boolean,
 *   isOverdue: boolean,
 * }}
 */
export const getAnnualChargeProgress = (charge, currentYear, currentMonth) => {
  const total = Number(charge.annualAmount || 0);
  const monthly = Number(charge.amount || 0);
  const dueMonthIndex = frMonthToIndex(charge.annualDueDate);

  let provisioned = 0;
  if (charge.validFrom) {
    const [fromYear, fromMonthRaw] = charge.validFrom.split('-').map(Number);
    const fromMonth = fromMonthRaw - 1;
    const monthsElapsed = (currentYear - fromYear) * 12 + (currentMonth - fromMonth) + 1;
    provisioned = Math.min(Math.max(monthsElapsed, 0) * monthly, total);
  }

  const remaining = Math.max(total - provisioned, 0);
  const progressPct = total > 0 ? Math.min((provisioned / total) * 100, 100) : 0;

  let monthsUntilDue = -1;
  let isDueThisMonth = false;
  let isOverdue = false;

  if (dueMonthIndex >= 0) {
    monthsUntilDue = dueMonthIndex - currentMonth;
    isDueThisMonth = dueMonthIndex === currentMonth;
    isOverdue = monthsUntilDue < 0 && remaining > 0;
  }

  return { provisioned, total, remaining, progressPct, dueMonthIndex, monthsUntilDue, isDueThisMonth, isOverdue };
};
