const { useState, useEffect, useCallback } = React

window.useSessions = function useSessions () {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    window.termAPI.listSessions().then(setSessions)
  }, [])

  const addSession = useCallback(async (cfg) => {
    const s = await window.termAPI.createSession(cfg)
    setSessions(prev => [...prev, s])
    return s
  }, [])

  const removeSession = useCallback(async (id) => {
    await window.termAPI.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  const updateSession = useCallback(async (id, patch) => {
    await window.termAPI.updateSession(id, patch)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [])

  return { sessions, addSession, removeSession, updateSession }
}
