import React, { useState, useEffect } from 'react';
import { useFormData } from '../contexts/FormDataContext';

const AREA_RANGES = [
  { label: '0-20m²', min: 0, max: 20 },
  { label: '21-40m²', min: 21, max: 40 },
  { label: '41-60m²', min: 41, max: 60 },
  { label: '61-80m²', min: 61, max: 80 },
  { label: '81-100m²', min: 81, max: 100 },
  { label: '101-120m²', min: 101, max: 120 },
  { label: '121-140m²', min: 121, max: 140 },
  { label: '141-160m²', min: 141, max: 160 },
  { label: '161m² +', min: 161, max: Infinity },
];

// ------------------- Room Editor -------------------
export default function RoomEditor() {
  const { formData, updateFormData } = useFormData();
  const [newRoom, setNewRoom] = useState({ name: '', size: '' });

  const handleAddRoom = () => {
    const rooms = formData.rooms || [];
    const trimmedName = newRoom.name.trim();
  
    // 🔒 Prevent duplicate names (case-insensitive)
    const nameExists = rooms.some(r => r.name.toLowerCase() === trimmedName.toLowerCase());
  
    if (!trimmedName || isNaN(parseFloat(newRoom.size)) || nameExists) return;
  
    const updated = [...rooms, { name: trimmedName, size: parseFloat(newRoom.size) }];
    updateFormData({ rooms: updated });
    setNewRoom({ name: '', size: '' });
  };

  const handleDeleteRoom = (name) => {
    const updated = (formData.rooms || []).filter(r => r.name !== name);
    updateFormData({ rooms: updated });
  };

  return (
    <div>
      <h3>Rooms in Premises</h3>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Room name"
          value={newRoom.name}
          onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Size (m²)"
          value={newRoom.size}
          onChange={e => setNewRoom(r => ({ ...r, size: e.target.value }))}
        />
        <button onClick={handleAddRoom}>Add Room</button>
      </div>
      <ul>
        {(formData.rooms || []).map((room, i) => (
          <li key={i}>
            {room.name} — {room.size} m²
            <button style={{ marginLeft: '1rem' }} onClick={() => handleDeleteRoom(room.name)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------- Room Selector per Product -------------------
export function RoomSelector({ index }) {
  const { formData, updateFormData } = useFormData();
  const rooms = formData.rooms || [];
  const product = formData.installedProducts[index];
  const selected = product.selectedRooms || [];
  // ── AUTO‐SELECT ALL ROOMS ON FIRST RENDER ──
useEffect(() => {
  // if we have rooms but nothing selected yet…
  if (rooms.length > 0) {
    // build a fresh products array, cloning each product
    const updated = formData.installedProducts.map((p, i) =>
      i === index
        ? { ...p, selectedRooms: rooms.slice() }
        : p
    );
    updateFormData({ installedProducts: updated });
  }
// eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
}, [rooms]);


  const toggleRoom = (roomName) => {
    const alreadySelected = selected.some(r => r.name === roomName);
    let updatedSelected;

    if (alreadySelected) {
      updatedSelected = selected.filter(r => r.name !== roomName);
    } else {
      const room = rooms.find(r => r.name === roomName);
      updatedSelected = [...selected, room];
    }

    // Calculate total area from selected room objects
    const totalArea = updatedSelected.reduce((sum, room) => sum + (room?.size || 0), 0);

    const rangeLabel = AREA_RANGES.find(r => totalArea >= r.min && totalArea <= r.max)?.label || null;

    const updatedProducts = [...formData.installedProducts];
    updatedProducts[index] = {
      ...updatedProducts[index],
      selectedRooms: updatedSelected,
      selectedArea: rangeLabel,
    };

    updateFormData({ installedProducts: updatedProducts });
  };

  return (
    <div>
      <h4>Rooms Served by Product {index + 1}</h4>
      {rooms.map((room, i) => (
        <label key={i} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={selected.some(r => r.name === room.name)}
            onChange={() => toggleRoom(room.name)}
          />{' '}
          {room.name} ({room.size} m²)
        </label>
      ))}
    </div>
  );
}

// ------------------- Ducted Sizing Summary -------------------
export function SizingSummary({ product, index }) {
  const { formData, updateFormData } = useFormData();
  const allRooms = formData.rooms || [];
  const cap = parseFloat(product.heatingCapacity) || 0;

  const roomSizeToRange = (size) => {
    if (size <= 20) return { min: 2.5, max: 3 };
    if (size <= 40) return { min: 3, max: 5 };
    if (size <= 60) return { min: 5, max: 8 };
    return { min: 8, max: Infinity };
  };

  const selectedRoomObjs = (product.selectedRooms || []).map(room =>
    allRooms.find(r => r.name === room.name)
  ).filter(Boolean);

  const totalArea = selectedRoomObjs.reduce((sum, r) => sum + r.size, 0);
  const bucketLabel = product.selectedArea;
  let pass = true;
  let recommendedMin = 0;
  let recommendedMax = 0;
  let breakdown = [];

  if (bucketLabel) {
    const bucket = AREA_RANGES.find(r => r.label === bucketLabel);
    if (bucket) {
      // map bucket.min → low kW and bucket.max → high kW
      const low    = roomSizeToRange(bucket.min).min;
      const high  = roomSizeToRange(isFinite(bucket.max) ? bucket.max : bucket.min).max;
      recommendedMin = low;
      recommendedMax = high;
      pass = cap >= low && cap <= high;
    }
  }
  // 2. Existing ducted logic
  else if (product.productType === 'Ducted') {
    recommendedMin = (totalArea * 1.1) / 10;
    recommendedMax = (totalArea * 1.4) / 10;
    pass = cap >= recommendedMin && cap <= recommendedMax;
  }
  // 3. Existing multi‑split per‑room logic
  else {
    breakdown = selectedRoomObjs.map(r => {
      const { min, max } = roomSizeToRange(r.size);
      const within = cap >= min && cap <= max;
      if (!within) pass = false;
      return { room: r, min, max, within };
    });
  }

  // ✅ Now safe to use `pass`
  useEffect(() => {
    const updated = [...formData.installedProducts];
    if (updated[index]?.matchSize !== pass) {
      updated[index] = {
        ...updated[index],
        matchSize: pass
      };
      updateFormData({ installedProducts: updated });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
  }, [pass]);

  return (
    <div key={index} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
      <h3>Sizing Summary for Product {index + 1} ({product.productType})</h3>
      <p><strong>Total area:</strong> {totalArea} m²</p>
      <p><strong>Total heating provided:</strong> {cap.toFixed(1)} kW</p>

      {product.productType === 'Ducted' ? (
        <p><strong>Recommended:</strong> {recommendedMin.toFixed(2)} – {recommendedMax.toFixed(2)} kW</p>
      ) : (
        <ul>
          {breakdown.map(({ room, min, max, within }, j) => (
            <li key={j}>
              {room.name} ({room.size} m²): {within ? '✅' : '⚠️'} recommends {max === Infinity ? `+${min}` : `${min}–${max}`} kW
            </li>
          ))}
        </ul>
      )}

      {selectedRoomObjs.length > 0 && (
        pass ? (
          <p style={{ color: 'green' }}>✅ OK</p>
        ) : (
          <p style={{ color: 'red' }}>⚠️ Outside recommended range</p>
        )
      )}
    </div>
  );
}