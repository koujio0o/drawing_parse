import React from 'react';

/** Props for the PerspectiveControls component */
export interface PerspectiveControlsProps {
  /** Current field of view value */
  fov: number;
  /** Current pitch (vertical rotation) in degrees */
  rx: number;
  /** Current yaw (horizontal rotation) in degrees */
  ry: number;
  /** Min/max range for the FOV slider. Defaults to [50, 150]. */
  fovRange?: [number, number];
  /** Callback when FOV changes */
  onFovChange: (v: number) => void;
  /** Callback when pitch changes */
  onRxChange: (v: number) => void;
  /** Callback when yaw changes */
  onRyChange: (v: number) => void;
  /** Whether the grid overlay is currently visible */
  isGridVisible?: boolean;
  /** Callback to toggle grid visibility */
  onGridToggle?: () => void;
  /** Whether the answer overlay is currently visible */
  isAnswerVisible?: boolean;
  /** Callback to toggle answer visibility */
  onAnswerToggle?: () => void;
  /** Callback to advance to the next question */
  onNextQuestion?: () => void;
  /** Callback to clear all drawn content */
  onClearAll?: () => void;
}

/**
 * A reusable perspective control panel with FOV, pitch, and yaw sliders,
 * plus optional action buttons for grid toggle, answer reveal, etc.
 *
 * Renders a top-left glass-panel with sliders and an optional bottom-center
 * row of action buttons.
 */
const PerspectiveControls: React.FC<PerspectiveControlsProps> = ({
  fov,
  rx,
  ry,
  fovRange = [50, 150],
  onFovChange,
  onRxChange,
  onRyChange,
  isGridVisible,
  onGridToggle,
  isAnswerVisible,
  onAnswerToggle,
  onNextQuestion,
  onClearAll,
}) => {
  const hasActionButtons = onClearAll || onNextQuestion || onGridToggle || onAnswerToggle;

  return (
    <>
      {/* Top-left: perspective sliders */}
      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>パースの強さ: <span>{fov}</span></label>
          <input type="range" min={fovRange[0]} max={fovRange[1]} value={fov} onChange={e => onFovChange(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>縦アングル: <span>{rx}</span>°</label>
          <input type="range" min={-80} max={80} value={rx} onChange={e => onRxChange(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>
          <label>横アングル: <span>{ry}</span>°</label>
          <input type="range" min={-180} max={180} value={ry} onChange={e => onRyChange(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
      </div>

      {/* Bottom-center: action buttons */}
      {hasActionButtons && (
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 12 }}>
          {onClearAll && (
            <button className="glass-button btn-light" onClick={onClearAll}>全消去</button>
          )}
          {onNextQuestion && (
            <button className="glass-button btn-success" onClick={onNextQuestion}>次のお題</button>
          )}
          {onGridToggle && (
            <button className={`glass-button btn-primary outline ${isGridVisible ? 'active' : ''}`} onClick={onGridToggle}>補助線</button>
          )}
          {onAnswerToggle && (
            <button className={`glass-button ${isAnswerVisible ? 'btn-danger' : 'btn-primary'}`} style={{ width: 140 }} onClick={onAnswerToggle}>
              {isAnswerVisible ? '答えを隠す' : '答え合わせ'}
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default PerspectiveControls;
