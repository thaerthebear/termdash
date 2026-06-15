const { useState, useEffect, useRef, useCallback } = React

const AI_TOOLS = {
  'higgsfield':        { name: 'Higgsfield AI',      color: '#d4a017', placeholder: 'e.g. cinematic product reveal, anime fight scene, brand story video…' },
  'higgsfield-generate':{ name: 'Higgsfield Generate', color: '#d4a017', placeholder: 'e.g. generate a product image, animate this photo…' },
  'opus-clip':         { name: 'OpusClip',            color: '#7c3aed', placeholder: 'e.g. turn my 1hr podcast into Reels clips with hooks…' },
  'claude-ai':         { name: 'Claude',              color: '#d97706', placeholder: 'What do you need help with?' },
  'figma':             { name: 'Figma',               color: '#f24e1e', placeholder: 'e.g. design a dashboard, build a component system…' },
  'canva':             { name: 'Canva',               color: '#00c4cc', placeholder: 'e.g. social media pack, pitch deck, brand kit…' },
  'capcut':            { name: 'CapCut',              color: '#555555', placeholder: 'e.g. edit a vlog, add captions, create a reel…' },
  'anthropic-console': { name: 'Anthropic Console',   color: '#dc2626', placeholder: 'e.g. test a system prompt, compare models, build an API call…' },
  'prompt-lib':        { name: 'Prompt Library',      color: '#0891b2', placeholder: 'What kind of prompt do you need?' },
}

window.AIGoalModal = function AIGoalModal ({ toolId, onClose, onDispatch }) {
  const tool = AI_TOOLS[toolId] || { name: toolId, color: '#0078d4', placeholder: 'What\'s your goal?' }
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const inputRef = useRef(null)

  const handleFileDrop = useCallback((e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    setAttachedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, path: f.path }))])
  }, [])

  const handleFilePaste = useCallback((e) => {
    const files = Array.from(e.clipboardData?.files || [])
    if (!files.length) return
    e.preventDefault()
    setAttachedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, path: f.path }))])
  }, [])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  async function handleSend () {
    if (!goal.trim() || loading) return
    setLoading(true)
    await onDispatch(toolId, goal.trim())
    onClose()
  }

  function handleKey (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="ai-modal-backdrop" onClick={onClose}>
      <div className="ai-modal" style={{ '--tool-color': tool.color }} onClick={e => e.stopPropagation()}>
        <div className="ai-modal-bar" />
        <div className="ai-modal-header">
          <span className="ai-modal-name">{tool.name}</span>
          <button className="ai-modal-close" onClick={onClose}>×</button>
        </div>
        <p className="ai-modal-prompt">What's your goal? Claude will guide you through it.</p>
        <textarea
          ref={inputRef}
          className="ai-modal-input"
          placeholder={tool.placeholder}
          value={goal}
          rows={3}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={handleKey}
          onDrop={handleFileDrop}
          onDragOver={e => e.preventDefault()}
          onPaste={handleFilePaste}
        />
        {attachedFiles.length > 0 && (
          <div className="ai-modal-files">
            {attachedFiles.map((f, i) => (
              <span key={i} className="ai-modal-file-chip" title={f.path}>
                📎 {f.name}
                <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="ai-modal-footer">
          <span className="ai-modal-hint">Enter to send · Esc to cancel</span>
          <button
            className="ai-modal-send"
            style={{ background: tool.color }}
            onClick={handleSend}
            disabled={!goal.trim() || loading}
          >
            {loading ? 'Starting…' : '▶ Let\'s Go'}
          </button>
        </div>
      </div>
    </div>
  )
}
