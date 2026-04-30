import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Wallet, Settings,
  TrendingUp, ArrowRightLeft, PiggyBank, FolderKanban
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/salaries',  icon: TrendingUp,      label: 'Revenus' },
  { to: '/expenses',  icon: Receipt,          label: 'Dépenses' },
  { to: '/charges',   icon: Wallet,           label: 'Charges' },
  { to: '/savings',   icon: PiggyBank,        label: 'Épargne' },
  { to: '/projects',  icon: FolderKanban,     label: 'Projets' },
  { to: '/debts',     icon: ArrowRightLeft,   label: 'Dettes' },
  { to: '/settings',  icon: Settings,         label: 'Profil' },
];

const Sidebar = () => (
  <nav className="bottom-nav">
    {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      >
        <div className="icon-wrapper">
          <Icon size={19} className="nav-icon" />
        </div>
        <span className="nav-label">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default Sidebar;
