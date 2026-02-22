import React, { useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const nav = useNavigate()

  async function submit(e: any){
    e.preventDefault()
    try {
      console.log('Attempting login with email:', email)
      const res = await api.post('/auth/login', { email, password })
      console.log('Login response:', res.data)
      localStorage.setItem('token', res.data.access_token)
      // store user payload if present
      if (res.data.user) localStorage.setItem('user', JSON.stringify(res.data.user))
      console.log('Token stored, navigating to dashboard...')
      nav('/')
    } catch (err:any) {
      console.error('Login error:', err)
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal login'
      console.error('Error message:', errMsg)
      alert(errMsg)
    }
  }

  function handlePasswordCopy(e: React.ClipboardEvent<HTMLInputElement>){
    e.preventDefault()
    const stars = '*'.repeat(password.length || 8)
    try{
      e.clipboardData.setData('text/plain', stars)
    }catch(err){
      // ignore if clipboard not writable
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4 text-center">login</h2>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">Email</label>
          <input className="w-full p-2 border" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <label className="block text-sm">Kata sandi</label>
          <input className="w-full p-2 border" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} onCopy={handlePasswordCopy} />
          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded">login</button>
        </form>
      </div>

      
    </div>
  )
}
