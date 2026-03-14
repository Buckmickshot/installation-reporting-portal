// src/utils/FileUploadField.js
import React, { useRef, useState } from 'react';
import { FaEye, FaTrash } from 'react-icons/fa';

/**
 * Props:
 * - label: string title shown above the drop zone
 * - description?: string  ← new: helper text under the title
 * - attachments: File[] current files
 * - onFilesSelected: (files: File[]) => void
 * - accept: string (e.g. ".pdf,image/*")
 * - multiple: boolean
 */
export default function FileUploadField({
  label,
  description = '',
  attachments = [],
  onFilesSelected,
  accept = '.pdf,image/*',
  multiple = false,
  onDelete = () => {},
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = fileList => {
    const newFiles = Array.from(fileList);
  
    const existingKeys = new Set(attachments.map(f => f.name + f.size));
    const uniqueNewFiles = newFiles.filter(f => !existingKeys.has(f.name + f.size));
  
    onFilesSelected([...attachments, ...uniqueNewFiles]);
  };
  
  const handleInputChange = e => {
    processFiles(e.target.files);
    e.target.value = null;
  };
  const handleDrop      = e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); };
  const handleDragOver  = e => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = e => { e.preventDefault(); setDragOver(false); };
  const handleDelete    = idx => onDelete(idx, attachments[idx]);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Title */}
      <h3 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>{label}</h3>

      {/* Description (new) */}
      {description && (
        <p style={{
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#666',
          marginTop: 0,
          marginBottom: '0.75rem',
        }}>
          {description}
        </p>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current.click()}
        style={{
          border: dragOver ? '2px dashed #007bff' : '2px dashed #ccc',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          borderRadius: 4,
        }}
      >
        <p>Drag & drop files/pictures here, or click to browse</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* List of selected files */}
      {attachments.length > 0 && (
        <ul style={{ marginTop: '0.5rem', listStyle: 'none', padding: 0 }}>
          {attachments.map((file, idx) => {
            const isFile = file instanceof File;
            const displayName = isFile
              ? file.name
              : file.name;              // your DB-loaded object has a `.name`

            const previewUrl = isFile
              ? URL.createObjectURL(file)
              : file.url;               // ← use `.url` here

            return (
              <li key={idx} style={{ display:'flex', alignItems:'center', marginBottom:'0.5rem' }}>
                <span style={{ flexGrow:1 }}>{displayName}</span>
                <FaTrash onClick={() => handleDelete(idx)} style={{ cursor:'pointer', marginRight:'0.5rem' }}/>
                <FaEye   onClick={() => window.open(previewUrl, '_blank')} style={{ cursor:'pointer' }}/>
              </li>
            )
          })}


        </ul>
      )}
    </div>
);
}
