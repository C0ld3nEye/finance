import { 
  ShoppingBag, Home, Car, Gamepad2, HeartPulse, Smartphone, Tv, Gift, Dumbbell, Dog, ShieldCheck, Landmark, MoreHorizontal
} from 'lucide-react';

export const CATEGORY_CONFIG = {
  'Alimentation': { icon: ShoppingBag, color: '#ef4444', bg: '#fef2f2' },
  'Logement': { icon: Home, color: '#f59e0b', bg: '#fffbeb' },
  'Transport': { icon: Car, color: '#10b981', bg: '#f0fdf4' },
  'Loisirs': { icon: Gamepad2, color: '#3b82f6', bg: '#eff6ff' },
  'Santé': { icon: HeartPulse, color: '#ec4899', bg: '#fdf2f8' },
  'Shopping': { icon: Smartphone, color: '#8b5cf6', bg: '#f5f3ff' },
  'Abonnements': { icon: Tv, color: '#6366f1', bg: '#eef2ff' },
  'Cadeaux': { icon: Gift, color: '#f43f5e', bg: '#fff1f2' },
  'Sport': { icon: Dumbbell, color: '#06b6d4', bg: '#ecfeff' },
  'Animaux': { icon: Dog, color: '#d946ef', bg: '#fdf4ff' },
  'Assurances': { icon: ShieldCheck, color: '#14b8a6', bg: '#f0fdfa' },
  'Impôts': { icon: Landmark, color: '#64748b', bg: '#f8fafc' },
  'Autre': { icon: MoreHorizontal, color: '#94a3b8', bg: '#f1f5f9' }
};

export const getCategoryKey = (categoryName) => {
  if (!categoryName) return 'Autre';
  const cleanName = categoryName.trim().toLowerCase();
  const foundKey = Object.keys(CATEGORY_CONFIG).find(
    key => key.toLowerCase() === cleanName
  );
  return foundKey || 'Autre';
};

export const getCategoryConfig = (categoryName) => {
  const key = getCategoryKey(categoryName);
  return CATEGORY_CONFIG[key] || CATEGORY_CONFIG.Autre;
};

export const CATEGORIES = Object.keys(CATEGORY_CONFIG).filter(k => k !== 'Autre').concat(['Autre']);

