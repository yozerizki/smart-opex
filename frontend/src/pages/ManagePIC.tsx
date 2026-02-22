import React, { useEffect, useState } from 'react'
import api from '../api'

export default function ManagePIC(){
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [districts, setDistricts] = useState<any[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    position: '',
    nip: '',
    phone_number: '',
    nik_ktp: '',
    ktp_scan: null as File | null,
    district_id: '' as number | '',
    email: '',
    password: '',
    role: 'pic',
  })

  useEffect(()=>{ fetchUsers(); fetchDistricts() },[])

  async function fetchUsers(){
    setLoading(true)
    try{ const res = await api.get('/users'); setUsers(res.data) }finally{ setLoading(false) }
  }

  async function fetchDistricts(){
    const res = await api.get('/districts')
    setDistricts(res.data)
  }

  async function createOrUpdate(){
    if (form.role === 'verifikator') {
      if (!form.email || (!editingId && !form.password)) {
        return alert('Email dan password wajib diisi untuk verifikator')
      }
      if (!editingId) {
        await api.post('/users', {
          email: form.email,
          password: form.password,
          role: 'verifikator',
        })
      } else {
        await api.patch(`/users/${editingId}`, { role: 'verifikator', district_id: null })
      }
    } else {
      const missingRequired =
        !form.full_name ||
        !form.position ||
        !form.nip ||
        !form.phone_number ||
        !form.nik_ktp ||
        !form.district_id ||
        (!editingId && !form.ktp_scan) ||
        (!editingId && !form.email) ||
        (!editingId && !form.password)

      if (missingRequired) {
        if (editingId) {
          return alert('Lengkapi semua data PIC dan unggah scan KTP')
        } else {
          return alert('Lengkapi semua data: nama, jabatan, NIP, no. HP, NIK KTP, email, password, dan scan KTP')
        }
      }

      if (!editingId) {
        const userRes = await api.post('/users', {
          email: form.email,
          password: form.password,
          role: 'pic',
          district_id: Number(form.district_id),
        })
        await uploadProfile(userRes.data?.id)
      } else {
        await api.patch(`/users/${editingId}`, { role: 'pic', district_id: Number(form.district_id) })
        await uploadProfile(editingId)
      }
    }

    setEditingId(null)
    setForm({
      full_name: '',
      position: '',
      nip: '',
      phone_number: '',
      nik_ktp: '',
      ktp_scan: null,
      district_id: '',
      email: '',
      password: '',
      role: 'pic',
    })
    fetchUsers()
  }

  async function uploadProfile(userId: number){
    const payload = new FormData()
    payload.append('full_name', form.full_name)
    payload.append('position', form.position)
    payload.append('nip', form.nip)
    payload.append('phone_number', form.phone_number)
    payload.append('nik_ktp', form.nik_ktp)
    if (form.ktp_scan) payload.append('ktp_scan', form.ktp_scan)

    await api.patch(`/users/${userId}/profile`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  async function remove(id:number){
    if(!confirm('Delete user?')) return
    await api.delete(`/users/${id}`)
    fetchUsers()
  }

  return (
    <div className="relative left-1/2 -translate-x-1/2 w-full lg:w-[140%] max-w-none">
      <h2 className="text-lg font-medium mb-3">Manage Users</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <h4 className="font-medium">{editingId ? 'Edit User' : 'Tambah User'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <select className="p-2 border" value={form.role} onChange={e=>{
            const nextRole = e.target.value
            setForm({
              ...form,
              role: nextRole,
              district_id: nextRole === 'verifikator' ? '' : form.district_id,
            })
          }}>
            <option value="pic">PIC</option>
            <option value="verifikator">Verifikator</option>
          </select>
        </div>

        {form.role === 'pic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <input className="p-2 border" placeholder="Nama lengkap" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
            <input className="p-2 border" placeholder="Jabatan/fungsi/posisi" value={form.position} onChange={e=>setForm({...form,position:e.target.value})} />
            <input className="p-2 border" placeholder="NIP" value={form.nip} onChange={e=>setForm({...form,nip:e.target.value})} />
            <input className="p-2 border" placeholder="No. HP" value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} />
            <select className="p-2 border" value={form.district_id} onChange={e=>setForm({...form,district_id: e.target.value ? Number(e.target.value) : ''})}>
              <option value="">Pilih district</option>
              {districts.map((d:any)=> (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input className="p-2 border" placeholder="No. NIK KTP" value={form.nik_ktp} onChange={e=>setForm({...form,nik_ktp:e.target.value})} />
            <div>
              <label className="inline-block px-3 py-2 bg-blue-600 text-white rounded cursor-pointer text-sm">
                upload KTP {form.ktp_scan && `(${form.ktp_scan.name})`}
                <input type="file" accept="image/*" onChange={e=>setForm({...form,ktp_scan:e.target.files?.[0] || null})} className="hidden" />
              </label>
            </div>
          </div>
        )}
        {!editingId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            <input className="p-2 border" placeholder="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            <input className="p-2 border" placeholder="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={createOrUpdate} className="px-3 py-1 bg-green-600 text-white rounded">{editingId ? 'Simpan' : 'Buat'}</button>
          {editingId && (
            <button onClick={()=>{
              setEditingId(null)
              setForm({
                full_name: '',
                position: '',
                nip: '',
                phone_number: '',
                nik_ktp: '',
                ktp_scan: null,
                district_id: '',
                email: '',
                password: '',
                role: 'pic',
              })
            }} className="px-3 py-1 border rounded">Batal</button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h4 className="font-medium">Daftar Users</h4>
        {loading ? <div>Loading...</div> : (
          <div className="mt-2 w-full overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-2 whitespace-nowrap">Nama lengkap</th><th className="p-2 whitespace-nowrap">Role</th><th className="p-2 whitespace-nowrap">Jabatan</th><th className="p-2 whitespace-nowrap">NIP</th><th className="p-2 whitespace-nowrap">No. HP</th><th className="p-2 whitespace-nowrap">District</th><th className="p-2 whitespace-nowrap">NIK KTP</th><th className="p-2 whitespace-nowrap">Scan KTP</th><th className="p-2 whitespace-nowrap">Aksi</th></tr></thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="border-t">
                  <td className="p-2 align-top whitespace-nowrap">{u.user_profiles?.full_name || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">{u.role || '-'}</td>
                  <td className="p-2 align-top">{u.user_profiles?.position || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">{u.user_profiles?.nip || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">{u.user_profiles?.phone_number || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">{u.districts?.name || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">{u.user_profiles?.nik_ktp || '-'}</td>
                  <td className="p-2 align-top whitespace-nowrap">
                    {u.user_profiles?.ktp_scan_path ? (
                      <a className="text-blue-600 underline" href={`${((import.meta as any).env?.VITE_API_URL || 'http://localhost:3000')}/${u.user_profiles.ktp_scan_path.replace(/^\/+/, '')}`} target="_blank">Lihat</a>
                    ) : '-'}
                  </td>
                  <td className="p-2 align-top whitespace-nowrap space-x-2">
                    <button onClick={()=>{
                      setEditingId(u.id)
                      setForm({
                        full_name: u.user_profiles?.full_name || '',
                        position: u.user_profiles?.position || '',
                        nip: u.user_profiles?.nip || '',
                        phone_number: u.user_profiles?.phone_number || '',
                        nik_ktp: u.user_profiles?.nik_ktp || '',
                        ktp_scan: null,
                        district_id: u.district_id || '',
                        email: u.email || '',
                        password: '',
                        role: u.role || 'pic',
                      })
                    }} className="text-blue-600">Edit</button>
                    <button onClick={()=>remove(u.id)} className="text-red-600">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
