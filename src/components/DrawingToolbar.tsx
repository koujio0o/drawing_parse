import React, { useState, useEffect } from 'react';
import { globalZoomLocked, setGlobalZoomLocked, subscribeZoomLocked } from '../hooks/useZoomControls';

/** Props for the DrawingToolbar component */
export interface DrawingToolbarProps {
  /** Drawing tool state and setters */
  drawing: {
    currentTool: 'pen' | 'eraser';
    setCurrentTool: (tool: 'pen' | 'eraser') => void;
    currentColor: string;
    setCurrentColor: (color: string) => void;
    palette: string[];
  };
  /** Callback to undo the last stroke */
  onUndo: () => void;
  /** Optional callback to export as GIF. If provided, the GIF button is rendered. */
  onExportGif?: () => void;
  /** Whether a GIF export is currently in progress */
  isExporting?: boolean;
}

/**
 * A reusable bottom toolbar containing color palette, eraser, undo,
 * and optional GIF export button.
 *
 * Renders a bottom-right glass-panel with drawing tools and an optional
 * bottom-left GIF export button.
 */
const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  drawing,
  onUndo,
  onExportGif,
  isExporting = false,
}) => {
  const { currentTool, setCurrentTool, currentColor, setCurrentColor, palette } = drawing;

  const [isZoomLocked, setIsZoomLocked] = useState(globalZoomLocked);

  useEffect(() => {
    return subscribeZoomLocked(setIsZoomLocked);
  }, []);

  const handleZoomLockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalZoomLocked(e.target.checked);
  };

  const handleTogglePenEraser = () => {
    setCurrentTool(currentTool === 'pen' ? 'eraser' : 'pen');
  };

  return (
    <>
      {/* Right Edge: Vertical Tool Toggle & Zoom Lock */}
      <div className="glass-panel" style={{
        position: 'absolute', top: '50%', right: 15, transform: 'translateY(-50%)',
        zIndex: 25, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 16, padding: '20px 10px', borderRadius: 24
      }}>
        <button
          className={`glass-button ${currentTool === 'pen' ? 'btn-primary' : 'btn-light'}`}
          onClick={handleTogglePenEraser}
          style={{ width: 48, height: 48, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}
          title="ペン / 消しゴム (切り替え)"
        >
          {currentTool === 'pen' ? '✏️' : '🧽'}
        </button>

        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 11, fontWeight: 'bold', gap: 6, cursor: 'pointer', textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isZoomLocked}
            onChange={handleZoomLockChange}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <span style={{ lineHeight: 1.2 }}>ズーム<br />ロック</span>
        </label>
      </div>

      {/* Bottom-right: color palette + undo (eraser button removed since we have the toggle) */}
      <div className="glass-panel" style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 30 }}>
        <div style={{ display: 'flex', gap: 6, marginRight: 10, paddingRight: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
          {palette.map(c => (
            <button
              key={c}
              onClick={() => { setCurrentTool('pen'); setCurrentColor(c); }}
              style={{
                width: 24, height: 24, borderRadius: '50%', backgroundColor: c, border: 'none', cursor: 'pointer',
                boxShadow: currentColor === c && currentTool === 'pen' ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                transition: '0.2s'
              }}
            />
          ))}
        </div>
        <button className="btn-tool" onClick={onUndo}>↶ Undo</button>
      </div>

      {/* Bottom-left: GIF export (only if handler provided) */}
      {onExportGif && (
        <div style={{ position: 'absolute', bottom: 30, left: 30, zIndex: 20 }}>
          <button className="glass-button btn-warning" onClick={onExportGif} disabled={isExporting}>
            {isExporting ? '生成中...' : 'GIF保存'}
          </button>
        </div>
      )}
    </>
  );
};

export default DrawingToolbar;
