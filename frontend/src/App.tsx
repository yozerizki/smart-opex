import React, { useEffect, useState, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateActivity from './pages/CreateActivity'
import ActivityDetail from './pages/ActivityDetail'
import ManagePIC from './pages/ManagePIC'
import ManageDistrict from './pages/ManageDistrict'
import ManageGroupView from './pages/ManageGroupView'
import api from './api'

export default function App(){
  const [user, setUser] = useState<any>(null)
  const nav = useNavigate()

  useEffect(()=>{
    async function fetchMe(){
      try{
        const res = await api.get('/users/me')
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      }catch(e){
        // ignore: not logged in
      }
    }
    fetchMe()
  },[])

  // Redirect unauthenticated users to /login
  const location = useLocation()
  useEffect(() => {
    const token = localStorage.getItem('token')
    // allow access to vite HMR endpoints and assets by only checking SPA routes
    const publicPaths = ['/login']
    if (!token && !publicPaths.includes(location.pathname)) {
      nav('/login')
    }
    if (token && location.pathname === '/login') {
      nav('/', { replace: true })
    }
  }, [location.pathname, nav])

  const isLogin = location.pathname === '/login'

  const isAuthenticated = !!localStorage.getItem('token')

  function authCheck(){
    return !!localStorage.getItem('token')
  }

  // Idle logout: configurable minutes
  const IDLE_MINUTES = 15
  const idleTimeoutRef = useRef<number | null>(null)
  const resetIdleTimer = () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
    if (!authCheck()) return
    idleTimeoutRef.current = window.setTimeout(() => {
      // auto logout when idle
      logout()
      try { alert(`Anda telah dikeluarkan karena tidak aktif selama ${IDLE_MINUTES} menit.`) } catch (e) {}
    }, IDLE_MINUTES * 60 * 1000)
  }

  useEffect(() => {
    const events = ['mousemove','mousedown','keydown','touchstart','scroll'] as const
    const onActivity = () => resetIdleTimer()
    events.forEach(ev => window.addEventListener(ev, onActivity))
    // start timer if authenticated
    if (isAuthenticated) resetIdleTimer()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
    }
  }, [isAuthenticated])

  // read role from immediate localStorage to avoid nav race after login
  let storedUser: any = null
  try{
    const raw = localStorage.getItem('user')
    if(raw) storedUser = JSON.parse(raw)
  }catch(e){ storedUser = null }
  const effectiveRole = user?.role || storedUser?.role
  const isVerifikator = effectiveRole === 'verifikator'

  function logout(){
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    nav('/login')
  }

  

  return (
    <div className="max-w-4xl mx-auto p-4">
      <header className="relative mb-6 py-2">
        <div className="flex items-center">
          <img src="/logo-pertagas.png" alt="Logo" className="h-10 w-auto mr-3 object-contain" onError={(e:any)=>{e.currentTarget.style.display='none'}} />
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <h1 className="text-2xl font-bold">SMART OPEX</h1>
        </div>

        {!isLogin && isAuthenticated && (
          <nav className="absolute right-0 top-1/2 transform -translate-y-1/2 space-x-3">
            <Link to="/" className="text-sm text-blue-600">Dashboard</Link>
            <Link to="/create" className="text-sm text-blue-600">Tambah Kegiatan</Link>
            {isVerifikator && (
              <>
                <Link to="/manage-district" className="text-sm text-blue-600">Manage District</Link>
                <Link to="/manage-group-view" className="text-sm text-blue-600">Manage Group View</Link>
                <Link to="/manage-users" className="text-sm text-blue-600">Manage Users</Link>
              </>
            )}
            {isAuthenticated && (
              <button onClick={logout} className="text-sm text-red-600">log out</button>
            )}
          </nav>
        )}
      </header>

      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={authCheck() ? <Dashboard/> : <Navigate to="/login" replace />} />
        <Route path="/create" element={authCheck() ? <CreateActivity/> : <Navigate to="/login" replace />} />
        <Route path="/activity/:id" element={authCheck() ? <ActivityDetail/> : <Navigate to="/login" replace />} />
        <Route path="/manage-users" element={authCheck() ? <ManagePIC/> : <Navigate to="/login" replace />} />
        <Route path="/manage-district" element={authCheck() ? <ManageDistrict/> : <Navigate to="/login" replace />} />
        <Route path="/manage-group-view" element={authCheck() ? <ManageGroupView/> : <Navigate to="/login" replace />} />
      </Routes>
      <div style={{fontSize: '0.7rem'}} className="mt-6 text-center text-gray-400">
        developed by <a href="mailto:yozerizki@gmail.com" className="text-blue-600 underline">yozerizki&co</a> for <a href="https://pertagas.pertamina.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">PT. Pertamina Gas Operation East Java Area (OEJA)</a> - 2026
      </div>
    </div>
  )
}
