import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeScreen.css';

function TopBar() {
  const navigate = useNavigate();

  return (
    <div className="topbar">
      <div className="spacer" />
      <button 
        className="create-job-button"
        onClick={() => navigate('/create-job')}
      >
        Create Job
      </button>
    </div>
  );
}

export default TopBar;