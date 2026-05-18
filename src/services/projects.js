import { pb } from '../config/pocketbase';

const filter = (householdId) => `householdId = "${householdId}"`;

export const getProjects = async (householdId) => {
  if (!householdId) return [];
  return await pb.collection('projects').getFullList({ filter: filter(householdId) });
};

export const addProject = async (householdId, uid, project) => {
  const data = {
    ...project,
    userId: uid,
    householdId,
    currentAmount: 0,
    contributions: [],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  const record = await pb.collection('projects').create(data);
  return { id: record.id, ...record };
};

const cleanPayload = (payload) => {
  const clean = { ...payload };
  delete clean.id;
  delete clean.collectionId;
  delete clean.collectionName;
  delete clean.created;
  delete clean.updated;
  delete clean.expand;
  return clean;
};

export const updateProject = async (householdId, projectId, updates) => {
  await pb.collection('projects').update(projectId, cleanPayload(updates));
};

export const deleteProject = async (householdId, projectId) => {
  await pb.collection('projects').delete(projectId);
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
