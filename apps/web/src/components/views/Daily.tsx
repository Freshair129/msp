import React from 'react';
import { GKS_SERVICE } from '../../services/gksService';

interface DailyProps {
  onOpen: (id: string) => void;
}

export const Daily: React.FC<DailyProps> = ({ onOpen }) => {
  return (
    <div className="daily scroll-thin">
      <h1>Daily notes</h1>
      <div className="sub">Stream of consciousness — auto-linked into the graph.</div>
      {GKS_SERVICE.D.daily.map(d => (
        <div className="day" key={d.date}>
          <div className="date">{d.date}<b>{d.title}</b></div>
          <div>
            <ul>
              {d.entries.map((e, i) => <li key={i}>{GKS_SERVICE.renderInline(e, onOpen)}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};
