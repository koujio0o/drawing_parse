import { useState } from 'react';
import './index.css';
import ProliferationMode from './components/ProliferationMode';
import CircleMode from './components/CircleMode';
import SubtractionMode from './components/SubtractionMode';
import SphereMode from './components/SphereMode';
import SphereContourMode from './components/SphereContourMode';
import DiagonalCubeMode from './components/DiagonalCubeMode';
import RatioCuboidMode from './components/RatioCuboidMode';
import RatioPlaneMode from './components/RatioPlaneMode';
import EyeLevelMode from './components/EyeLevelMode';

// ... (skip lines to reach the component, I'll need to use proper StartLine and EndLine)

function App() {
  const [activeTab, setActiveTab] = useState<'proliferation' | 'circle' | 'subtraction' | 'sphere' | 'sphere_contour' | 'diagonal_cube' | 'ratio_cuboid' | 'ratio_plane' | 'eye_level'>('ratio_cuboid');

  return (
    <div className="app-container" style={{ width: '100vw', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      
      {/* Dynamic Navigation Header */}
      <header className="glass-panel" style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        width: 'max-content',
        maxWidth: '95vw',
        padding: '6px',
        gap: '4px',
        borderRadius: '30px'
      }}>
        <div style={{ position: 'absolute', top: '-18px', right: '0', fontSize: '10px', color: '#999' }}>
          v:23:35
        </div>
        <button 
          className={`glass-button ${activeTab === 'proliferation' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('proliferation')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          パース増殖
        </button>
        <button 
          className={`glass-button ${activeTab === 'circle' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('circle')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          円 (楕円)
        </button>
        <button 
          className={`glass-button ${activeTab === 'subtraction' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('subtraction')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          削り出し
        </button>
        <button 
          className={`glass-button ${activeTab === 'sphere' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('sphere')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          球体・曲面
        </button>
        <button 
          className={`glass-button ${activeTab === 'sphere_contour' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('sphere_contour')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          円 (輪郭)
        </button>
        <button 
          className={`glass-button ${activeTab === 'diagonal_cube' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('diagonal_cube')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          斜め45度接合
        </button>
        <button 
          className={`glass-button ${activeTab === 'ratio_cuboid' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('ratio_cuboid')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          比率(直方体)
        </button>
        <button 
          className={`glass-button ${activeTab === 'ratio_plane' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('ratio_plane')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          比率(平面)
        </button>
        <button 
          className={`glass-button ${activeTab === 'eye_level' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('eye_level')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          アイレベル
        </button>
      </header>

      {/* Main Content Area */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        {activeTab === 'proliferation' && <ProliferationMode />}
        {activeTab === 'circle' && <CircleMode />}
        {activeTab === 'subtraction' && <SubtractionMode />}
        {activeTab === 'sphere' && <SphereMode />}
        {activeTab === 'sphere_contour' && <SphereContourMode />}
        {activeTab === 'diagonal_cube' && <DiagonalCubeMode />}
        {activeTab === 'ratio_cuboid' && <RatioCuboidMode />}
        {activeTab === 'ratio_plane' && <RatioPlaneMode />}
        {activeTab === 'eye_level' && <EyeLevelMode />}
      </div>

    </div>
  );
}

export default App;
