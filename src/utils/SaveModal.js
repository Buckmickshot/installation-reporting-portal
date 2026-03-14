import React from 'react';
import '../components/jobCreation/JobScreen.css'; // or wherever your styles live

function SaveModal({ visible, errorMessages, onClose }) {
  if (!visible) return null;

  return (
    <div className="overlay">
      <div className="modal">
        <h2>Missing or Invalid Fields</h2>
        {Object.keys(errorMessages).map((section) => (
          <div key={section}>
            <strong>{section}</strong>
            <ul>
              {errorMessages[section].map((field, i) => (
                <li key={i}>{field}</li>
              ))}
            </ul>
          </div>
        ))}
        <button className="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default SaveModal;
