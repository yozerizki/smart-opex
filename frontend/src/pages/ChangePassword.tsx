import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function ChangePassword(){
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const nav = useNavigate()

  async function handleSave(){
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Password baru wajib diisi')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Password tidak sama')
      return
    }
    setErrorMsg('')
    setSaving(true)
    try{
      await api.patch('/users/me/password', { password: newPassword })
      nav('/')
    }catch(err:any){
      setErrorMsg(err?.response?.data?.message || 'Gagal menyimpan password')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-md bg-white p-6 rounded shadow">
        <h3 className="text-lg font-medium mb-4">Ganti Password</h3>
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="px-2 py-1 text-sm border rounded"
              onMouseDown={()=>setShowPassword(true)}
              onMouseUp={()=>setShowPassword(false)}
              onMouseLeave={()=>setShowPassword(false)}
              onTouchStart={()=>setShowPassword(true)}
              onTouchEnd={()=>setShowPassword(false)}
            >
              Lihat
            </button>
          </div>
          <div>
            <label className="block text-sm mb-1">New password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full p-2 border"
              value={newPassword}
              onChange={e=>setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Confirm new password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full p-2 border"
              value={confirmPassword}
              onChange={e=>setConfirmPassword(e.target.value)}
            />
          </div>
          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 bg-green-600 text-white rounded"
            >
              Simpan
            </button>
            <button
              onClick={()=>nav('/')}
              className="px-3 py-2 border rounded"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
