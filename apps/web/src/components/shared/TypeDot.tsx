import React from 'react';
import type { NoteType } from '../../types/gks';
import { TYPE_META } from '../../types/gks';

interface TypeDotProps {
  type: NoteType | string;
  size?: number;
  glow?: boolean;
}

export const TypeDot: React.FC<TypeDotProps> = ({ type, size = 8 }) => {
  const meta = TYPE_META[type as NoteType];
  const c = meta?.color || "var(--text-dim)";
  return (
    <span 
      className="dot" 
      style={{ 
        background: c, 
        width: size, 
        height: size,
        borderRadius: "50%",
        display: "inline-block",
        border: '1px solid rgba(0,0,0,0.1)'
      }} 
    />
  );
};
