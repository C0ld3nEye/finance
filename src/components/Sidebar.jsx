import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Wallet, Settings } from 'lucide-react';
import { auth } from '../config/firebase';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar glass">
      <div className="sidebar-header">
        <div className="logo-icon">
          <Wallet className="icon-main" size={24} />
        </div>
        <h2>Family Finance</h2>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Receipt size={20} />
          <span>Dépenses</span>
        </NavLink>
        <NavLink to="/charges" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Wallet size={20} />
          <span>Charges Fixes</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Paramètres</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-info" style={{ marginBottom: '1rem' }}>
          <div className="avatar">F</div>
          <span>Foyer</span>
        </div>
        <button 
          onClick={() => auth.signOut()} 
          className="btn btn-outline" 
          style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', justifyContent: 'center' }}
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
