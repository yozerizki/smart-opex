import React, { useEffect, useState } from 'react'
import api from '../api'

export default function ManageDistrict(){
  const [role, setRole] = useState('')
  const [regions, setRegions] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [districts, setDistricts] = useState<any[]>([])
  const [regionId, setRegionId] = useState<number | ''>('')
  const [areaId, setAreaId] = useState<number | ''>('')
  const [newRegionName, setNewRegionName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(()=>{ bootstrap() },[])

  async function bootstrap(){
    const me = await api.get('/users/me')
    setRole(me.data?.role || '')
    await fetchRegions()
    await fetchAreas()
    await fetchDistricts()
  }

  async function fetchRegions(){
    const res = await api.get('/districts/regions')
    setRegions(res.data)
  }

  async function fetchAreas(nextRegionId?: number | ''){
    const params = nextRegionId ? { region_id: nextRegionId } : (regionId ? { region_id: regionId } : undefined)
    const res = await api.get('/districts/areas', { params })
    setAreas(res.data)
  }

  async function fetchDistricts(){
    const params: any = {}
    if (regionId) params.region_id = regionId
    if (areaId) params.area_id = areaId
    const res = await api.get('/districts', { params: Object.keys(params).length ? params : undefined })
    setDistricts(res.data)
  }

  async function createRegion(){
    if (!newRegionName.trim()) return alert('Nama region wajib diisi')
    await api.post('/districts/regions', { name: newRegionName })
    setNewRegionName('')
    await fetchRegions()
  }

  async function createArea(){
    if (!regionId) return alert('Pilih region dulu')
    if (!newAreaName.trim()) return alert('Nama area wajib diisi')
    await api.post('/districts/areas', { region_id: Number(regionId), name: newAreaName })
    setNewAreaName('')
    await fetchAreas(regionId)
  }

  async function create(){
    if(!name.trim()) return alert('Nama district wajib diisi')
    const payload: any = { name }
    if (role === 'pusat') {
      if (!areaId) return alert('Pilih area dulu')
      payload.area_id = Number(areaId)
    }
    await api.post('/districts', payload)
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
      <h2 className="text-lg font-medium mb-3">Manage Region / Area / District</h2>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h4 className="font-medium">Filter Hierarchy</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
          <select
            className="p-2 border"
            value={regionId}
            onChange={async (e)=>{
              const nextRegion = e.target.value ? Number(e.target.value) : ''
              setRegionId(nextRegion)
              setAreaId('')
              await fetchAreas(nextRegion)
            }}
          >
            <option value="">Semua Region</option>
            {regions.map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select
            className="p-2 border"
            value={areaId}
            onChange={e=>setAreaId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Semua Area</option>
            {areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={fetchDistricts} className="px-3 py-1 bg-blue-600 text-white rounded">Terapkan Filter</button>
        </div>
      </div>

      {role === 'pusat' && (
        <>
          <div className="bg-white p-4 rounded shadow mb-4">
            <h4 className="font-medium">Tambah Region</h4>
            <div className="flex gap-2 mt-2">
              <input className="p-2 border flex-1" placeholder="Nama region" value={newRegionName} onChange={e=>setNewRegionName(e.target.value)} />
              <button onClick={createRegion} className="px-3 py-1 bg-green-600 text-white rounded">Buat</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow mb-4">
            <h4 className="font-medium">Tambah Area</h4>
            <div className="flex gap-2 mt-2">
              <input className="p-2 border flex-1" placeholder="Nama area" value={newAreaName} onChange={e=>setNewAreaName(e.target.value)} />
              <button onClick={createArea} className="px-3 py-1 bg-green-600 text-white rounded">Buat</button>
            </div>
          </div>
        </>
      )}

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
          <thead className="bg-gray-100"><tr><th className="p-2 text-left">Region</th><th className="p-2 text-left">Area</th><th className="p-2 text-left">District</th><th className="p-2">Aksi</th></tr></thead>
          <tbody>
            {districts.map(d=> (
              <tr key={d.id} className="border-t">
                <td className="p-2">{d.areas?.regions?.name || '-'}</td>
                <td className="p-2">{d.areas?.name || '-'}</td>
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
