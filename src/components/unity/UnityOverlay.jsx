import React from 'react';
import './UnityOverlay.css';

export default function UnityOverlay({ loadError, unityReady, onRetry, isLoading, isReady }) {
  if (loadError) {
    return (
      <div className="unity-overlay unity-overlay--error">
        <div className="unity-overlay__box">
          <h3 className="unity-overlay__title">Failed to load Unity</h3>
          <p className="unity-overlay__msg">{loadError && loadError.message ? loadError.message : String(loadError)}</p>
          <div className="unity-overlay__actions">
            <button onClick={onRetry} className="unity-overlay__btn">Retry</button>
          </div>
        </div>
      </div>
    );
  }
  // Prefer booleans when provided; fall back to unityReady if needed.
  const showLoading = typeof isLoading === 'boolean' ? isLoading && !isReady : !unityReady;

  if (showLoading) {
    return (
      <div className="unity-overlay unity-overlay--loading">
        <div className="unity-overlay__box unity-overlay__spinner">
          <div style={{ marginBottom: 8 }}>{typeof isLoading === 'boolean' && isLoading && !isReady ? 'Loading Unity Player' : 'Loading Unity Player'}</div>
          <svg viewBox="0 0 50 50" aria-hidden="true">
            <circle cx="25" cy="25" r="20" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="31.4 31.4" />
          </svg>
        </div>
      </div>
    );
  }

  return null;
}
