import React from 'react';

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

  return (
    <>
      {/* Bottom-right: color palette + eraser + undo */}
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
        <button className={`btn-tool ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => setCurrentTool('eraser')}>消しゴム</button>
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
