import React, { useEffect, useState } from 'react'
import api from '../api'

export default function ManageGroupView(){
  const [groupViews, setGroupViews] = useState<any[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(()=>{ fetchGroupViews() },[])

  async function fetchGroupViews(){
    const res = await api.get('/group-views')
    setGroupViews(res.data)
  }

  async function create(){
    if(!name.trim()) return alert('Nama group view wajib diisi')
    await api.post('/group-views', { name })
    setName('')
    fetchGroupViews()
  }

  async function save(){
    if(!editingId || !editingName.trim()) return alert('Nama group view wajib diisi')
    await api.put(`/group-views/${editingId}`, { name: editingName })
    setEditingId(null)
    setEditingName('')
    fetchGroupViews()
  }

  async function remove(id: number){
    if(!confirm('Hapus group view?')) return
    await api.delete(`/group-views/${id}`)
    fetchGroupViews()
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-3">Manage Group View</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <h4 className="font-medium">Tambah Group View</h4>
        <div className="flex gap-2 mt-2">
          <input className="p-2 border flex-1" placeholder="Nama group view" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={create} className="px-3 py-1 bg-green-600 text-white rounded">Buat</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h4 className="font-medium">Daftar Group View</h4>
        <table className="w-full mt-2">
          <thead className="bg-gray-100"><tr><th className="p-2 text-left">Nama</th><th className="p-2">Aksi</th></tr></thead>
          <tbody>
            {groupViews.map(g=> (
              <tr key={g.id} className="border-t">
                <td className="p-2">
                  {editingId === g.id ? (
                    <input className="p-1 border w-full" value={editingName} onChange={e=>setEditingName(e.target.value)} />
                  ) : g.name}
                </td>
                <td className="p-2 space-x-2">
                  {editingId === g.id ? (
                    <>
                      <button onClick={save} className="text-blue-600">Simpan</button>
                      <button onClick={()=>{ setEditingId(null); setEditingName('') }} className="text-gray-600">Batal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>{ setEditingId(g.id); setEditingName(g.name) }} className="text-blue-600">Edit</button>
                      <button onClick={()=>remove(g.id)} className="text-red-600">Hapus</button>
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
