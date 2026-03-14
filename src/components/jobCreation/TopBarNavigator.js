// src/components/TopBarNavigator.js
import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import './TopBarNavigator.css'
import { FaHome, FaSave, FaTrash } from 'react-icons/fa'
import { useFormData } from '../../contexts/FormDataContext'
import { save } from '../../relationship/save'
import { useAuth } from "../../contexts/AuthProvider"
import ConfirmModal from './ConfirmModal'

export default function TopBarNavigator() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { formData, resetFormData, updateFormData } = useFormData()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const tabs = [
    { path: 'customer',    label: 'Customer Info' },
    { path: 'decommission',label: 'Decommission' },
    { path: 'benefit',     label: 'Benefit & Install' },
    { path: 'worker',      label: 'Workers' },
    { path: 'review',      label: 'Review Install' },
    { path: 'postInstall', label: 'Post Install' },
    { path: 'declaration', label: 'Declaration' },
  ];

  const handleSave = async () => {
    const { invalidFields } = formData;
    const errorMessages = Object.entries(invalidFields)
      .flatMap(([section, fields]) =>
        Object.entries(fields)
          .filter(([, msg]) => !!msg)
          .map(([field, msg]) => `• ${section} → ${field}: ${msg}`)
      );

    if (errorMessages.length > 0) {
      alert(`Please fix the following errors before saving:\n\n${errorMessages.join('\n')}`);
      return;
    }

    try {
      await save(formData, signOut, updateFormData, navigate)
      alert('Data saved successfully.')
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save data. Please try again.')
    }
  }

  const handleDelete = () => {
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    resetFormData()

    // 2) (optional) call an API to delete on the backend
    //    await supabase.from('installation').delete().eq('installation_id', installationId)

    setShowDeleteModal(false)
    navigate('/')
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
  }

  return (
    <>
      <div className="topbar-nav">
        <div className="left-section">
          <FaHome className="icon home-icon" onClick={() => navigate('/')} />
        </div>
        
        <div className="nav-tabs">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                isActive ? 'nav-tab active' : 'nav-tab'
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>

        <div className="right-section">
          <FaSave className="icon save-icon" onClick={handleSave} />
          <FaTrash className="icon delete-icon" onClick={handleDelete} />
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Confirm Delete Installation"
        message={
          <>
            <p>
              <strong>Warning:</strong> Deleting this installation will
              permanently remove all related records (consumer details,
              plumbers, certificates, and uploaded documents) from the database.
            </p>
            <p>This action cannot be undone. Are you sure?</p>
          </>
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  )
}
