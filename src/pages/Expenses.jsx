import React, { useState, useEffect } from 'react';
import { getExpensesByMonth, addExpense, deleteExpense } from '../services/expenses';
import { getSettings } from '../services/settings';
import { auth } from '../config/firebase';
import { Plus, Trash2, ChevronLeft, ChevronRight, Calendar, Tag } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

const Expenses = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Alimentation',
    paidBy: '', // member id
    accountId: '' // bank account id
  });

  const categories = ['Alimentation', 'Logement', 'Transport', 'Loisirs', 'Santé', 'Autre'];

  useEffect(() => {
    fetchData(currentDate);
  }, [currentDate]);

  const fetchData = async (date) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const [expensesData, settingsData] = await Promise.all([
        getExpensesByMonth(uid, year, month),
        getSettings(uid)
      ]);
      setExpenses(expensesData);
      setSettings(settingsData);
      
      // Auto-select first member and first account if not set
      setNewExpense(prev => ({ 
        ...prev, 
        paidBy: prev.paidBy || (settingsData?.members?.[0]?.id || ''),
        accountId: prev.accountId || (settingsData?.accounts?.[0]?.id || '')
      }));
    } catch (error) {
      console.error("Error loading expenses", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleAdd = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !newExpense.description || !newExpense.amount || !newExpense.accountId) return;
    
    // Convert local date string to ISO string for Firebase
    const expenseDate = new Date(newExpense.date);
    expenseDate.setMinutes(expenseDate.getMinutes() + expenseDate.getTimezoneOffset());
    
    const expenseToSave = {
      ...newExpense,
      amount: Number(newExpense.amount),
      date: expenseDate.toISOString()
    };
    
    try {
      const saved = await addExpense(uid, expenseToSave);
      const savedDate = new Date(saved.date);
      if (savedDate.getMonth() === currentDate.getMonth() && savedDate.getFullYear() === currentDate.getFullYear()) {
         setExpenses([saved, ...expenses].sort((a,b) => new Date(b.date) - new Date(a.date)));
      }
      setShowAddForm(false);
      setNewExpense({ ...newExpense, description: '', amount: '' });
    } catch (error) {
      console.error("Error adding expense", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer cette dépense ?")) {
      await deleteExpense(id);
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const getMemberName = (id) => {
    if (!settings) return '';
    const mem = settings.members.find(m => m.id === id);
    return mem ? mem.name : 'Inconnu';
  };

  const getAccountName = (id) => {
    if (!settings) return '';
    const acc = settings.accounts.find(a => a.id === id);
    return acc ? acc.name : 'Inconnu';
  };

  const totalMonth = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Dépenses Courantes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Historique des dépenses mensuelles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={18} /> Nouvelle Dépense
        </button>
      </header>
      
      {/* Month Selector */}
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem' }}>
        <button onClick={handlePrevMonth} className="btn btn-outline" style={{ border: 'none' }}>
           <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', textTransform: 'capitalize' }}>
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button onClick={handleNextMonth} className="btn btn-outline" style={{ border: 'none' }}>
           <ChevronRight size={24} />
        </button>
      </div>

      {showAddForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '1px solid var(--primary-light)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Ajouter une Dépense</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Description / Libellé</label>
              <input type="text" className="input-field" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="ex: Courses Leclerc" />
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input type="number" className="input-field" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-field" required value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input-field" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Payé par</label>
              <select className="input-field" value={newExpense.paidBy} onChange={e => setNewExpense({...newExpense, paidBy: e.target.value})}>
                {settings?.members?.map(mem => (
                  <option key={mem.id} value={mem.id}>{mem.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Compte de prélèvement</label>
              <select className="input-field" value={newExpense.accountId} onChange={e => setNewExpense({...newExpense, accountId: e.target.value})}>
                {settings?.accounts?.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer Dépense</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Dépenses de {format(currentDate, 'MMMM', { locale: fr })}</h3>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>Total : {totalMonth.toFixed(2)} €</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {expenses.map((expense) => (
              <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.backgroundColor='var(--primary-light)'} onMouseOut={e => e.currentTarget.style.backgroundColor='var(--surface-color)'}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{format(new Date(expense.date), 'MMM', { locale: fr })}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{format(new Date(expense.date), 'dd')}</span>
                  </div>
                  <div>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '1.05rem' }}>{expense.description}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Tag size={12} /> {expense.category}</span>
                      <span>• Par : {getMemberName(expense.paidBy)}</span>
                      <span>• Compte : <span style={{color: 'var(--text-primary)', fontWeight: '500'}}>{getAccountName(expense.accountId)}</span></span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>{expense.amount.toFixed(2)} €</span>
                  <button onClick={() => handleDelete(expense.id)} style={{ color: 'var(--text-secondary)', padding: '0.5rem', backgroundColor: 'transparent', cursor: 'pointer', border: 'none' }} onMouseOver={e => e.currentTarget.style.color='var(--danger)'} onMouseOut={e => e.currentTarget.style.color='var(--text-secondary)'}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Aucune dépense enregistrée pour ce mois.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
