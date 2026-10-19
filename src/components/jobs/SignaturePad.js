import React, { useEffect, useRef, useState } from 'react';

/** Finger/mouse signature capture. onSave(blob) receives a PNG. */
export default function SignaturePad({ onSave, onCancel, busy = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  const pos = e => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = e => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = e => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEmpty(false);
  };
  const up = () => (drawing.current = false);

  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="sigpad"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        aria-label="Signature area"
      />
      <div className="capture-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={clear} disabled={busy}>Clear</button>
        {onCancel && <button className="btn small ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button
          className="btn small primary"
          disabled={empty || busy}
          onClick={() => canvasRef.current.toBlob(b => onSave(b), 'image/png')}
        >
          {busy ? 'Saving…' : 'Save signature'}
        </button>
      </div>
    </div>
  );
}
