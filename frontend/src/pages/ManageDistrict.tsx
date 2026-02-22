import React, { useEffect, useState } from 'react'
import api from '../api'

export default function ManageDistrict(){
  const [districts, setDistricts] = useState<any[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(()=>{ fetchDistricts() },[])

  async function fetchDistricts(){
    const res = await api.get('/districts')
    setDistricts(res.data)
  }

  async function create(){
    if(!name.trim()) return alert('Nama district wajib diisi')
    await api.post('/districts', { name })
    setName('')
    fetchDistricts()
  }

  async function save(){
    if(!editingId || !editingName.trim()) return alert('Nama district wajib diisi')
    await api.put(`/districts/${editingId}`, { name: editingName })
    setEditingId(null)
    setEditingName('')
    fetchDistricts()
  }

  async function remove(id: number){
    if(!confirm('Hapus district?')) return
    await api.delete(`/districts/${id}`)
    fetchDistricts()
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-3">Manage District</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <h4 className="font-medium">Tambah District</h4>
        <div className="flex gap-2 mt-2">
          <input className="p-2 border flex-1" placeholder="Nama district" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={create} className="px-3 py-1 bg-green-600 text-white rounded">Buat</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h4 className="font-medium">Daftar District</h4>
        <table className="w-full mt-2">
          <thead className="bg-gray-100"><tr><th className="p-2 text-left">Nama</th><th className="p-2">Aksi</th></tr></thead>
          <tbody>
            {districts.map(d=> (
              <tr key={d.id} className="border-t">
                <td className="p-2">
                  {editingId === d.id ? (
                    <input className="p-1 border w-full" value={editingName} onChange={e=>setEditingName(e.target.value)} />
                  ) : d.name}
                </td>
                <td className="p-2 space-x-2">
                  {editingId === d.id ? (
                    <>
                      <button onClick={save} className="text-blue-600">Simpan</button>
                      <button onClick={()=>{ setEditingId(null); setEditingName('') }} className="text-gray-600">Batal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>{ setEditingId(d.id); setEditingName(d.name) }} className="text-blue-600">Edit</button>
                      <button onClick={()=>remove(d.id)} className="text-red-600">Hapus</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
