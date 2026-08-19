import './SidePanel.css'

export default function SidePanel({ mode, onModeChange }) {
  return (
    <div className="side-panel">

      {/* Side pannel design */}
      <span className="side-panel__shape side-panel__shape--wash" />
      <span className="side-panel__shape side-panel__shape--chevron-dark" />
      <span className="side-panel__shape side-panel__shape--chevron" />
      <span className="side-panel__shape side-panel__shape--slab" />

      {/* Buttons */}
      <nav className="side-panel__tabs">
        <Tab label="LOGIN" active={mode === 'login'} onClick={() => onModeChange('login')} />
        <Tab label="SIGN UP" active={mode === 'signup'} onClick={() => onModeChange('signup')} />
      </nav>

    </div>
  )
}

// Button Designs
function Tab({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`tab${active ? ' tab--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
