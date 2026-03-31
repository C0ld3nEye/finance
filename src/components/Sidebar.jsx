import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Wallet, Settings, TrendingUp, ArrowRightLeft } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <LayoutDashboard size={22} className="nav-icon" />
        </div>
        <span>Accueil</span>
      </NavLink>
      
      <NavLink to="/salaries" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <TrendingUp size={22} className="nav-icon" />
        </div>
        <span>Revenus</span>
      </NavLink>
      
      <NavLink to="/expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <Receipt size={22} className="nav-icon" />
        </div>
        <span>Dépenses</span>
      </NavLink>
      
      <NavLink to="/charges" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <Wallet size={22} className="nav-icon" />
        </div>
        <span>Charges</span>
      </NavLink>
      
      <NavLink to="/debts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <ArrowRightLeft size={22} className="nav-icon" />
        </div>
        <span>Dettes</span>
      </NavLink>
      
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-wrapper">
          <Settings size={22} className="nav-icon" />
        </div>
        <span>Profil</span>
      </NavLink>
    </nav>
  );
};

export default Sidebar;
