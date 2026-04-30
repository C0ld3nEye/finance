/**
 * Utilitaires pour le calcul du "mois courant" selon le jour de début de compte.
 *
 * Si accountStartDay = 15, le mois courant va du 15/N au 14/N+1.
 * Ex : le 10 avril, on est encore dans la période "mars" (15 mars → 14 avril).
 * Ex : le 20 avril, on est dans la période "avril" (15 avril → 14 mai).
 */

/**
 * Retourne l'année et le mois "comptable" en tenant compte du jour de début.
 * @param {Date} date - Date à évaluer (default: aujourd'hui)
 * @param {number} startDay - Jour du mois où commence le mois comptable (1-28, default: 1)
 * @returns {{ year: number, month: number }} - month est 0-based
 */
export const getAccountingMonth = (date = new Date(), startDay = 1) => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  if (startDay <= 1) {
    // Comportement standard
    return { year, month };
  }

  if (day < startDay) {
    // On est avant le jour de début : on est encore dans le mois précédent
    const prevDate = new Date(year, month - 1, 1);
    return { year: prevDate.getFullYear(), month: prevDate.getMonth() };
  }

  return { year, month };
};

/**
 * Retourne la clé "YYYY-MM" du mois comptable courant.
 */
export const getCurrentMonthKey = (startDay = 1) => {
  const { year, month } = getAccountingMonth(new Date(), startDay);
  return `${year}-${(month + 1).toString().padStart(2, '0')}`;
};

/**
 * Vérifie si une dépense (par sa date) appartient au mois comptable (year, month).
 * @param {string|Date} expenseDate
 * @param {number} year - Année comptable (0-based month)
 * @param {number} month - Mois comptable (0-based)
 * @param {number} startDay - Jour de début du mois comptable
 */
export const isInAccountingMonth = (expenseDate, year, month, startDay = 1) => {
  const d = new Date(expenseDate);
  if (isNaN(d)) return false;

  if (startDay <= 1) {
    return d.getFullYear() === year && d.getMonth() === month;
  }

  // Début du mois comptable : jour startDay du mois (year, month)
  const periodStart = new Date(year, month, startDay);
  // Fin : le jour startDay - 1 du mois suivant (inclus)
  const periodEnd = new Date(year, month + 1, startDay - 1, 23, 59, 59);

  return d >= periodStart && d <= periodEnd;
};

/**
 * Vérifie si une charge (avec validFrom/validTo en "YYYY-MM") est active
 * pour un mois comptable donné.
 */
export const isChargeActiveInMonth = (charge, year, month) => {
  const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const from = charge.validFrom || '0000-01';
  const to = charge.validTo || '9999-12';
  return monthKey >= from && monthKey <= to;
};

/**
 * Formate une date de mois comptable en label français.
 */
export const formatAccountingMonthLabel = (year, month, startDay = 1) => {
  if (startDay <= 1) {
    return new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  const periodStart = new Date(year, month, startDay);
  // Le mois se termine la veille du jour de début le mois suivant
  const periodEnd = new Date(year, month + 1, startDay - 1);
  
  const formatterStart = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  const formatterEnd = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return `Du ${formatterStart.format(periodStart)} au ${formatterEnd.format(periodEnd)}`;
};

/**
 * Retourne le mois comptable précédent ou suivant.
 */
export const shiftAccountingMonth = (year, month, delta) => {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
