// src/components/ConfirmModal.js
import React from 'react'
import './ConfirmModal.css'

export default function ConfirmModal({  
  isOpen,  
  title,  
  message,  
  onConfirm,  
  onCancel  
}) {  
  if (!isOpen) return null  

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
