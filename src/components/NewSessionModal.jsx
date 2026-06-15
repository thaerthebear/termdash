const { useState } = React

const COLORS = ['#0078d4','#4ec9b0','#c586c0','#569cd6','#f44747','#dcdcaa','#d4a017','#b5cea8','#ce9178','#dc2626']

window.NewSessionModal = function NewSessionModal ({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name:    '',
    kind:    'terminal',
    cwd:     '', // empty → main process defaults to THIS user's home (os.homedir())
    shell:   'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    args:    '',
    color:   '#0078d4',
    section: 'Terminals',
  })

  function set (k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit (e) {
    e.preventDefault()
    const cfg = {
      name:    form.name,
      kind:    form.kind,
      type:    'custom',
      color:   form.color,
      icon:    'custom',
      section: form.section,
      cwd:     form.kind === 'terminal' ? form.cwd : null,
      shell:   form.kind === 'terminal' ? form.shell : null,
      args:    form.kind === 'terminal' ? form.args.split(' ').filter(Boolean) : [],
      url:     form.kind === 'launcher' ? form.url : null,
      path:    form.kind === 'launcher' ? form.path : null,
    }
    await onAdd(cfg)
    onClose()
  }

  return (
    <div style={OVERLAY}>
      <div style={MODAL}>
        <h2 style={{ marginBottom: 16, fontSize: 15 }}>New Session</h2>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <label style={LABEL}>Name
            <input style={INPUT} value={form.name} onChange={e=>set('name',e.target.value)} required />
          </label>
          <label style={LABEL}>Type
            <select style={INPUT} value={form.kind} onChange={e=>set('kind',e.target.value)}>
              <option value="terminal">Terminal (PTY)</option>
              <option value="launcher">Launcher (URL/Folder)</option>
            </select>
          </label>
          {form.kind === 'terminal' ? (
            <>
              <label style={LABEL}>Starting Directory
                <input style={INPUT} value={form.cwd} onChange={e=>set('cwd',e.target.value)} placeholder="Leave blank for your home folder" />
              </label>
              <label style={LABEL}>Shell
                <input style={INPUT} value={form.shell} onChange={e=>set('shell',e.target.value)} />
              </label>
              <label style={LABEL}>Args (space-separated)
                <input style={INPUT} value={form.args} onChange={e=>set('args',e.target.value)} placeholder="-NoExit -Command claude" />
              </label>
            </>
          ) : (
            <>
              <label style={LABEL}>URL (leave blank for local folder)
                <input style={INPUT} value={form.url||''} onChange={e=>set('url',e.target.value)} placeholder="https://..." />
              </label>
              <label style={LABEL}>Local Path (optional)
                <input style={INPUT} value={form.path||''} onChange={e=>set('path',e.target.value)} placeholder="C:\Users\YourName\..." />
              </label>
            </>
          )}
          <div>
            <div style={{ fontSize:11, color:'#808080', marginBottom:6 }}>Color</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={()=>set('color',c)}
                  style={{
                    width:22, height:22, borderRadius:4, background:c, cursor:'pointer',
                    outline: form.color===c ? '2px solid #fff' : 'none',
                    outlineOffset: 2
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
            <button type="button" style={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button type="submit" style={BTN_OK}>Add Session</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const OVERLAY = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
  display:'flex', alignItems:'center', justifyContent:'center', zIndex:999
}
const MODAL = {
  background:'#252526', border:'1px solid #3c3c3c', borderRadius:10,
  padding:24, width:400, maxWidth:'90vw'
}
const LABEL = { display:'flex', flexDirection:'column', gap:4, fontSize:11, color:'#808080' }
const INPUT = {
  background:'#1e1e1e', border:'1px solid #3c3c3c', borderRadius:4,
  color:'#cccccc', padding:'6px 8px', fontSize:12, outline:'none',
  fontFamily:'inherit'
}
const BTN_CANCEL = { ...INPUT, cursor:'pointer', padding:'6px 16px' }
const BTN_OK = {
  ...INPUT, cursor:'pointer', padding:'6px 16px',
  background:'#0078d4', border:'1px solid #0078d4', color:'#fff', fontWeight:600
}
