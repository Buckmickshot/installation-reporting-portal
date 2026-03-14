import React from 'react';
import './Modal.css'; // optional if you want to style it

export default function Modal({ onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-btn">×</button>
        {children}
      </div>
    </div>
  );
}
