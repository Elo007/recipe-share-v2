import { useState } from 'react';

export default function StarInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= (hovered || value) ? 'filled' : ''}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-checked={value === n}
          role="radio"
        >
          {n <= (hovered || value) ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
