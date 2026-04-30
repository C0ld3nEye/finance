import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const col = (householdId) => collection(db, 'households', householdId, 'projects');

export const getProjects = async (householdId) => {
  if (!householdId) return [];
  const snap = await getDocs(col(householdId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addProject = async (householdId, uid, project) => {
  const data = {
    ...project,
    userId: uid,
    currentAmount: 0,
    contributions: [],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col(householdId), data);
  return { id: ref.id, ...data };
};

export const updateProject = async (householdId, projectId, updates) => {
  await updateDoc(doc(db, 'households', householdId, 'projects', projectId), updates);
};

export const deleteProject = async (householdId, projectId) => {
  await deleteDoc(doc(db, 'households', householdId, 'projects', projectId));
};

// Ajoute une contribution manuelle à un projet
export const addContribution = async (householdId, project, amount, note = '') => {
  const contribution = {
    amount: Number(amount),
    note,
    date: new Date().toISOString(),
  };
  const newContributions = [...(project.contributions || []), contribution];
  const newAmount = newContributions.reduce((s, c) => s + c.amount, 0);
  await updateProject(householdId, project.id, {
    contributions: newContributions,
    currentAmount: newAmount,
    status: newAmount >= Number(project.targetAmount) ? 'reached' : 'active',
  });
  return { contributions: newContributions, currentAmount: newAmount };
};

// Supprime une contribution par index
export const removeContribution = async (householdId, project, index) => {
  const newContributions = project.contributions.filter((_, i) => i !== index);
  const newAmount = newContributions.reduce((s, c) => s + c.amount, 0);
  await updateProject(householdId, project.id, {
    contributions: newContributions,
    currentAmount: newAmount,
    status: newAmount >= Number(project.targetAmount) ? 'reached' : 'active',
  });
  return { contributions: newContributions, currentAmount: newAmount };
};
