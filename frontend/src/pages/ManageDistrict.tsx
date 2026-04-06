import React, { useEffect, useState } from 'react'
import api from '../api'

type Mode = 'region' | 'area' | 'district'

export default function ManageDistrict(){
  const [role, setRole] = useState('')
  const [regions, setRegions] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [districts, setDistricts] = useState<any[]>([])
  const [mode, setMode] = useState<Mode>('region')

  const [regionForArea, setRegionForArea] = useState<number | ''>('')
  const [regionForDistrict, setRegionForDistrict] = useState<number | ''>('')
  const [areaForDistrict, setAreaForDistrict] = useState<number | ''>('')

  const [newRegionName, setNewRegionName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [newDistrictName, setNewDistrictName] = useState('')

  const [editingRegionId, setEditingRegionId] = useState<number | null>(null)
  const [editingRegionName, setEditingRegionName] = useState('')

  const [editingAreaId, setEditingAreaId] = useState<number | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')

  const [editingDistrictId, setEditingDistrictId] = useState<number | null>(null)
  const [editingDistrictName, setEditingDistrictName] = useState('')

  useEffect(()=>{ bootstrap() },[])

  async function bootstrap(){
    const me = await api.get('/users/me')
    setRole(me.data?.role || '')
    await fetchRegions()
  }

  async function fetchRegions(){
    const res = await api.get('/districts/regions')
    setRegions(res.data)
  }

  async function fetchAreas(regionId?: number | ''){
    const params = regionId ? { region_id: regionId } : undefined
    const res = await api.get('/districts/areas', { params })
    setAreas(res.data)
  }

  async function fetchDistricts(regionId?: number | '', areaId?: number | ''){
    const params: any = {}
    if (regionId) params.region_id = Number(regionId)
    if (areaId) params.area_id = Number(areaId)
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
    if (!regionForArea) return alert('Pilih region dulu')
    if (!newAreaName.trim()) return alert('Nama area wajib diisi')
    await api.post('/districts/areas', { region_id: Number(regionForArea), name: newAreaName })
    setNewAreaName('')
    await fetchAreas(regionForArea)

    if (regionForDistrict && Number(regionForDistrict) === Number(regionForArea)) {
      await fetchAreas(regionForDistrict)
    }
  }

  async function createDistrict(){
    if (!newDistrictName.trim()) return alert('Nama district wajib diisi')
    if (!areaForDistrict) return alert('Pilih area dulu')
    const payload: any = { name: newDistrictName, area_id: Number(areaForDistrict) }
    await api.post('/districts', payload)
    setNewDistrictName('')
    await fetchDistricts(regionForDistrict, areaForDistrict)
  }

  async function saveRegion(id: number){
    if (!editingRegionName.trim()) return alert('Nama region wajib diisi')
    await api.put(`/districts/regions/${id}`, { name: editingRegionName.trim() })
    setEditingRegionId(null)
    setEditingRegionName('')
    await fetchRegions()
  }

  async function saveArea(id: number){
    if (!editingAreaName.trim()) return alert('Nama area wajib diisi')
    await api.put(`/districts/areas/${id}`, { name: editingAreaName.trim() })
    setEditingAreaId(null)
    setEditingAreaName('')
    await fetchAreas(regionForArea)
    if (regionForDistrict) await fetchAreas(regionForDistrict)
    if (areaForDistrict) await fetchDistricts(regionForDistrict, areaForDistrict)
  }

  async function saveDistrict(id: number){
    if (!editingDistrictName.trim()) return alert('Nama district wajib diisi')
    await api.put(`/districts/${id}`, { name: editingDistrictName.trim() })
    setEditingDistrictId(null)
    setEditingDistrictName('')
    await fetchDistricts(regionForDistrict, areaForDistrict)
  }

  async function removeRegion(id: number){
    if (!confirm('Hapus region?')) return
    await api.delete(`/districts/regions/${id}`)

    if (Number(regionForArea) === id) {
      setRegionForArea('')
      setAreas([])
    }
    if (Number(regionForDistrict) === id) {
      setRegionForDistrict('')
      setAreaForDistrict('')
      setAreas([])
      setDistricts([])
    }

    await fetchRegions()
  }

  async function removeArea(id: number){
    if (!confirm('Hapus area?')) return
    await api.delete(`/districts/areas/${id}`)

    if (Number(areaForDistrict) === id) {
      setAreaForDistrict('')
      setDistricts([])
    }

    await fetchAreas(regionForArea)
    if (regionForDistrict) await fetchAreas(regionForDistrict)
  }

  async function removeDistrict(id: number){
    if (!confirm('Hapus district?')) return
    await api.delete(`/districts/${id}`)
    await fetchDistricts(regionForDistrict, areaForDistrict)
  }

  async function onSelectRegionForArea(nextValue: string){
    const nextRegionId = nextValue ? Number(nextValue) : ''
    setRegionForArea(nextRegionId)
    setEditingAreaId(null)
    setEditingAreaName('')
    if (!nextRegionId) {
      setAreas([])
      return
    }
    await fetchAreas(nextRegionId)
  }

  async function onSelectRegionForDistrict(nextValue: string){
    const nextRegionId = nextValue ? Number(nextValue) : ''
    setRegionForDistrict(nextRegionId)
    setAreaForDistrict('')
    setEditingDistrictId(null)
    setEditingDistrictName('')

    if (!nextRegionId) {
      setAreas([])
      setDistricts([])
      return
    }

    await fetchAreas(nextRegionId)
    setDistricts([])
  }

  async function onSelectAreaForDistrict(nextValue: string){
    const nextAreaId = nextValue ? Number(nextValue) : ''
    setAreaForDistrict(nextAreaId)
    setEditingDistrictId(null)
    setEditingDistrictName('')

    if (!nextAreaId) {
      setDistricts([])
      return
    }

    await fetchDistricts(regionForDistrict, nextAreaId)
  }

  if (role && role !== 'pusat') {
    return (
      <div className="bg-white/85 border border-gray-200 rounded-xl shadow p-4">
        <h2 className="text-lg font-medium mb-3">Manage Region / Area / District</h2>
        <div className="text-sm text-red-700">Halaman ini hanya dapat diakses role pusat.</div>
      </div>
    )
  }

  return (
    <div className="bg-white/85 border border-gray-200 rounded-xl shadow p-4">
      <h2 className="text-lg font-medium mb-3">Manage Region / Area / District</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={()=>setMode('region')}
          className={`px-3 py-1 rounded border ${mode === 'region' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}
        >
          Manage Region
        </button>
        <button
          onClick={()=>setMode('area')}
          className={`px-3 py-1 rounded border ${mode === 'area' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}
        >
          Manage Area
        </button>
        <button
          onClick={()=>setMode('district')}
          className={`px-3 py-1 rounded border ${mode === 'district' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}
        >
          Manage District
        </button>
      </div>

      {mode === 'region' && (
        <div>
          <div className="flex gap-2 items-center mb-3">
            <input
              className="p-2 border flex-1 bg-white"
              placeholder="Nama region"
              value={newRegionName}
              onChange={e=>setNewRegionName(e.target.value)}
            />
            <button onClick={createRegion} className="px-4 py-2 bg-green-600 text-white rounded">Buat</button>
          </div>

          <div className="space-y-2">
            {regions.length === 0 && <div className="text-sm text-gray-500">Belum ada region.</div>}
            {regions.map((r:any)=> (
              <div key={r.id} className="flex items-center gap-2 p-2 border rounded bg-white/80">
                {editingRegionId === r.id ? (
                  <input
                    className="p-2 border flex-1 bg-white"
                    value={editingRegionName}
                    onChange={e=>setEditingRegionName(e.target.value)}
                  />
                ) : (
                  <div className="flex-1">{r.name}</div>
                )}

                {editingRegionId === r.id ? (
                  <>
                    <button onClick={()=>saveRegion(r.id)} className="text-blue-600">Simpan</button>
                    <button onClick={()=>{ setEditingRegionId(null); setEditingRegionName('') }} className="text-gray-600">Batal</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>{ setEditingRegionId(r.id); setEditingRegionName(r.name) }} className="text-blue-600">Edit</button>
                    <button onClick={()=>removeRegion(r.id)} className="text-red-600 font-semibold">X</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'area' && (
        <div>
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center mb-3">
            <select
              className="p-2 border bg-white md:w-64"
              value={regionForArea}
              onChange={async (e)=>onSelectRegionForArea(e.target.value)}
            >
              <option value="">Pilih Region</option>
              {regions.map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <input
              className="p-2 border flex-1 bg-white"
              placeholder="Nama area"
              value={newAreaName}
              onChange={e=>setNewAreaName(e.target.value)}
              disabled={!regionForArea}
            />

            <button onClick={createArea} className="px-4 py-2 bg-green-600 text-white rounded md:self-stretch">Buat</button>
          </div>

          {!regionForArea && <div className="text-sm text-gray-500">Pilih region untuk melihat daftar area.</div>}

          {regionForArea && (
            <div className="space-y-2">
              {areas.length === 0 && <div className="text-sm text-gray-500">Belum ada area pada region terpilih.</div>}
              {areas.map((a:any)=> (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded bg-white/80">
                  {editingAreaId === a.id ? (
                    <input
                      className="p-2 border flex-1 bg-white"
                      value={editingAreaName}
                      onChange={e=>setEditingAreaName(e.target.value)}
                    />
                  ) : (
                    <div className="flex-1">{a.name}</div>
                  )}

                  {editingAreaId === a.id ? (
                    <>
                      <button onClick={()=>saveArea(a.id)} className="text-blue-600">Simpan</button>
                      <button onClick={()=>{ setEditingAreaId(null); setEditingAreaName('') }} className="text-gray-600">Batal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>{ setEditingAreaId(a.id); setEditingAreaName(a.name) }} className="text-blue-600">Edit</button>
                      <button onClick={()=>removeArea(a.id)} className="text-red-600 font-semibold">X</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'district' && (
        <div>
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center mb-3">
            <select
              className="p-2 border bg-white md:w-64"
              value={regionForDistrict}
              onChange={async (e)=>onSelectRegionForDistrict(e.target.value)}
            >
              <option value="">Pilih Region</option>
              {regions.map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <select
              className="p-2 border bg-white md:w-64"
              value={areaForDistrict}
              onChange={async (e)=>onSelectAreaForDistrict(e.target.value)}
              disabled={!regionForDistrict}
            >
              <option value="">Pilih Area</option>
              {areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <input
              className="p-2 border flex-1 bg-white"
              placeholder="Nama district"
              value={newDistrictName}
              onChange={e=>setNewDistrictName(e.target.value)}
              disabled={!areaForDistrict}
            />

            <button onClick={createDistrict} className="px-4 py-2 bg-green-600 text-white rounded md:self-stretch">Buat</button>
          </div>

          {!regionForDistrict && <div className="text-sm text-gray-500">Pilih region terlebih dahulu.</div>}
          {regionForDistrict && !areaForDistrict && (
            <div className="text-sm text-gray-500">Pilih area untuk melihat daftar district.</div>
          )}

          {areaForDistrict && (
            <div className="space-y-2">
              {districts.length === 0 && <div className="text-sm text-gray-500">Belum ada district pada area terpilih.</div>}
              {districts.map((d:any)=> (
                <div key={d.id} className="flex items-center gap-2 p-2 border rounded bg-white/80">
                  {editingDistrictId === d.id ? (
                    <input
                      className="p-2 border flex-1 bg-white"
                      value={editingDistrictName}
                      onChange={e=>setEditingDistrictName(e.target.value)}
                    />
                  ) : (
                    <div className="flex-1">{d.name}</div>
                  )}

                  {editingDistrictId === d.id ? (
                    <>
                      <button onClick={()=>saveDistrict(d.id)} className="text-blue-600">Simpan</button>
                      <button onClick={()=>{ setEditingDistrictId(null); setEditingDistrictName('') }} className="text-gray-600">Batal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>{ setEditingDistrictId(d.id); setEditingDistrictName(d.name) }} className="text-blue-600">Edit</button>
                      <button onClick={()=>removeDistrict(d.id)} className="text-red-600 font-semibold">X</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
