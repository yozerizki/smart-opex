import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from 'react-router-dom'

export default function Dashboard(){
  const [items, setItems] = useState<any[]>([])
  const [filterMonth, setFilterMonth] = useState<string>(() => new Date().toISOString().slice(0,7))
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterDistrict, setFilterDistrict] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [itemsFetched, setItemsFetched] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [role, setRole] = useState('')
  const [districts, setDistricts] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(()=>{ fetchItems() },[filterDistrict, role])
  useEffect(()=>{
    async function bootstrap(){
      try{
        const me = await api.get('/users/me')
        setRole(me.data?.role || '')
      }catch(e){
        // ignore
      }
      try{
        const res = await api.get('/districts')
        setDistricts(res.data)
      }catch(e){
        // ignore
      }
    }
    bootstrap()
  },[])

  async function fetchItems(){
    setLoading(true)
    setItemsFetched(false)
    try{
      const params: any = {}
      if (role === 'verifikator' && filterDistrict) params.district_id = filterDistrict
      const res = await api.get('/opex', { params })
      setItems(res.data)
      setItemsFetched(true)
    }catch(err:any){
      if(err?.response?.status === 401){
        navigate('/login')
        return
      }
      setItemsFetched(true)
      throw err
    }finally{ setLoading(false) }
  }

  async function remove(id:number){
    if(!confirm('Delete activity?')) return
    await api.delete(`/opex/${id}`)
    fetchItems()
  }

  async function exportExcel(){
    setExporting(true)
    try{
      const r = await api.get('/opex/export', { responseType: 'arraybuffer' })
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'smart-opex.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    }finally{ setExporting(false) }
  }

  function goCreate(){
    window.location.href = '/create'
  }

  // summary counts respect the currently selected filters
  const counts = items.reduce((acc:any,i:any)=>{
    // status filter
    if (filterStatus === 'OK_OR_REVIEWED' && !(i.status === 'OK' || i.status === 'TELAH_DIREVIEW')) return acc
    if (filterStatus === 'PERLU_REVIEW' && i.status !== 'PERLU_REVIEW') return acc
    // month filter (YYYY-MM)
    if(filterMonth){
      const td = i.transaction_date ? new Date(i.transaction_date) : null
      if(!td) return acc
      const m = td.toISOString().slice(0,7)
      if(m !== filterMonth) return acc
    }
    if(i.status === 'OK' || i.status === 'TELAH_DIREVIEW') acc.ok++
    else if(i.status === 'PERLU_REVIEW') acc.review++
    return acc
  }, { ok: 0, review: 0 })

  const filteredItems = items.filter(i=>{
    // status filter
    if (filterStatus === 'OK_OR_REVIEWED' && !(i.status === 'OK' || i.status === 'TELAH_DIREVIEW')) return false
    if (filterStatus === 'PERLU_REVIEW' && i.status !== 'PERLU_REVIEW') return false
    // month filter (YYYY-MM)
    if(filterMonth){
      const td = i.transaction_date ? new Date(i.transaction_date) : null
      if(!td) return false
      const m = td.toISOString().slice(0,7)
      if(m !== filterMonth) return false
    }
    return true
  })

  const hasPendingOcr = items.some((i:any) => (i.opex_receipts || []).some((r:any) => r.ocr_detected_total === null || r.ocr_detected_total === undefined))

  useEffect(() => {
    if (!hasPendingOcr) return
    const interval = setInterval(() => {
      fetchItems()
    }, 10000)
    return () => clearInterval(interval)
  }, [hasPendingOcr])

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-medium">Dashboard</h2>

        <div className="flex gap-4 mt-3">
          <div className="flex-1 p-4 bg-blue-50 rounded shadow flex flex-col">
            <div className="text-xs text-gray-500">OK</div>
            <div className="text-3xl font-bold mt-2 text-blue-800">{counts.ok}</div>
          </div>
          <div className="flex-1 p-4 bg-red-50 rounded shadow flex flex-col">
            <div className="text-xs text-gray-500">PERLU REVIEW</div>
            <div className="text-3xl font-bold mt-2 text-red-800">{counts.review}</div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <button onClick={goCreate} className="px-3 py-1 bg-green-600 text-white rounded">Tambah Kegiatan</button>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Bulan</label>
          <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="p-1 border" />
          {role === 'verifikator' && (
            <select value={filterDistrict} onChange={e=>setFilterDistrict(e.target.value)} className="p-1 border">
              <option value="">All Districts</option>
              {districts.map((d:any)=> (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="p-1 border">
            <option value="">Semua Status</option>
            <option value="OK_OR_REVIEWED">OK / Telah Direview</option>
            <option value="PERLU_REVIEW">Perlu Review</option>
          </select>
        </div>
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Tanggal</th>
            <th className="p-2">Nama Kegiatan</th>
            <th className="p-2">Group View</th>
            <th className="p-2">District</th>
            <th className="p-2">Nama Toko / Penerima</th>
            <th className="p-2">Pengeluaran</th>
            <th className="p-2">Total OCR</th>
            <th className="p-2">Status</th>
            <th className="p-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.length === 0 && !loading && itemsFetched ? (
            <tr><td colSpan={9} className="p-4 text-center text-gray-500">Tidak ada data</td></tr>
          ) : filteredItems.map(i=> (
            <tr key={i.id} className={`border-t ${i.status==='PERLU_REVIEW' ? 'bg-yellow-50' : (i.status==='OK' || i.status==='TELAH_DIREVIEW') ? 'bg-green-50' : ''}`}>
              <td className="p-2">{i.transaction_date ? new Date(i.transaction_date).toLocaleDateString() : '-'}</td>
              <td className="p-2">{i.item_name || '-'}</td>
              <td className="p-2">{i.group_views?.name || '-'}</td>
              <td className="p-2">{i.districts?.name || '-'}</td>
              <td className="p-2">{i.recipient_name || '-'}</td>
              <td className="p-2">{i.amount ?? '-'}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span>{i.total_ocr ?? 0}</span>
                  {(i.opex_receipts || []).some((r:any) => r.ocr_detected_total === null || r.ocr_detected_total === undefined) && (
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">OCR pending</span>
                  )}
                </div>
              </td>
              <td className="p-2">{i.status || '-'}</td>
              <td className="p-2 space-x-2">
                <Link className="text-blue-600" to={`/activity/${i.id}`}>Lihat</Link>
                <button onClick={()=>remove(i.id)} className="text-red-600">Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <div className="mt-2 text-sm text-gray-500">Loading...</div>}
      <div className="mt-3 flex justify-between items-center">
        <div>
          <button onClick={exportExcel} disabled={exporting} className="px-3 py-1 bg-indigo-600 text-white rounded">Ekspor ke Excel</button>
        </div>
      </div>
    </div>
  )
}
