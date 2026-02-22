import React, { useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'

export default function CreateActivity(){
  const [itemName, setItemName] = useState('')
  const [manualTotal, setManualTotal] = useState(0)
  const [groupViewId, setGroupViewId] = useState<number | ''>('')
  const [groupViews, setGroupViews] = useState<any[]>([])
  const [recipientName, setRecipientName] = useState('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [districts, setDistricts] = useState<any[]>([])
  const [districtName, setDistrictName] = useState('')
  const [role, setRole] = useState<string>('')
  const todayStr = new Date().toISOString().split('T')[0]
  const [transactionDate, setTransactionDate] = useState(todayStr)
  const [errorMsg, setErrorMsg] = useState('')
  const nav = useNavigate()
  const [receipts, setReceipts] = useState<(File | null)[]>([null])

  React.useEffect(() => {
    async function bootstrap(){
      try{
        const me = await api.get('/users/me')
        setRole(me.data?.role || '')
        if (me.data?.district_id) setDistrictId(me.data.district_id)
        if (me.data?.districts?.name) setDistrictName(me.data.districts.name)
      }catch(e){
        // ignore
      }
      try{
        const res = await api.get('/districts')
        setDistricts(res.data)
      }catch(e){
        // ignore
      }
      try{
        const res = await api.get('/group-views')
        setGroupViews(res.data)
      }catch(e){
        // ignore
      }
    }
    bootstrap()
  }, [])

  async function submit(e:any){
    e.preventDefault()
    // validate date not in future
    if(transactionDate > todayStr){
      setErrorMsg('Tanggal transaksi tidak boleh di masa depan.')
      return
    }
    // validate required fields
    if(!itemName || !manualTotal || !groupViewId || !transactionDate || !recipientName){
      setErrorMsg('Data harus diisi lengkap')
      return
    }
    if (role === 'verifikator' && !districtId) {
      setErrorMsg('District harus dipilih')
      return
    }
    const selectedReceipts = receipts.filter(Boolean) as File[]
    if(selectedReceipts.length === 0){
      setErrorMsg('Harap unggah minimal 1 file Nota.')
      return
    }
    if(selectedReceipts.length > 10){
      setErrorMsg('Maksimal 10 file Nota.')
      return
    }
    try{
      const fd = new FormData()
      fd.append('item_name', itemName)
      fd.append('manual_total', String(manualTotal))
      fd.append('group_view_id', String(groupViewId))
      fd.append('transaction_date', transactionDate)
      fd.append('recipient_name', recipientName)
      if (role === 'verifikator' && districtId) fd.append('district_id', String(districtId))
      selectedReceipts.forEach((file) => fd.append('receipts', file))

      const res = await api.post('/opex', fd, { headers: {'Content-Type': 'multipart/form-data'} })
      nav(`/activity/${res.data.id}`)
    }catch(err:any){
      alert(err?.response?.data?.message || 'Gagal membuat kegiatan')
    }
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-2xl bg-white p-6 rounded shadow">
      <div className="flex items-center mb-3">
        <h3 className="text-lg font-medium">Buat Kegiatan</h3>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Nama Kegiatan</label>
        <input className={`w-full p-2 border ${!itemName && errorMsg? 'border-red-600':''}`} placeholder="Nama kegiatan" value={itemName} onChange={e=>setItemName(e.target.value)} />
        <label className="block text-sm">Pengeluaran</label>
        <input className={`w-full p-2 border ${!manualTotal && errorMsg? 'border-red-600':''}`} placeholder="Pengeluaran" type="number" value={manualTotal} onChange={e=>setManualTotal(Number(e.target.value))} />
        <label className="block text-sm">District</label>
        {role === 'verifikator' ? (
          <select className="w-full p-2 border" value={districtId} onChange={e=>setDistrictId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Pilih district</option>
            {districts.map((d:any)=> (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        ) : (
          <input className="w-full p-2 border bg-gray-50" value={districts.find((d:any)=>d.id === districtId)?.name || districtName || ''} readOnly />
        )}

        <label className="block text-sm">Group View</label>
        <select className="w-full p-2 border" value={groupViewId} onChange={e=>setGroupViewId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Pilih group view</option>
          {groupViews.map((g:any)=> (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <label className="block text-sm">Nama Toko / Penerima</label>
        <input className={`w-full p-2 border ${!recipientName && errorMsg? 'border-red-600':''}`} placeholder="Nama toko atau penerima" value={recipientName} onChange={e=>setRecipientName(e.target.value)} />
        <label className="block text-sm">Tanggal Transaksi</label>
        <input className="w-full p-2 border" placeholder="Transaction date" type="date" value={transactionDate} max={todayStr} onChange={e=>setTransactionDate(e.target.value)} />

        {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Nota (minimal 1, maksimal 10)</h4>
            <button
              type="button"
              onClick={()=>{
                if (receipts.length >= 10) return
                setReceipts([...receipts, null])
              }}
              className="px-2 py-1 text-sm border rounded"
            >Tambah Nota</button>
          </div>
          <div className="mt-2 space-y-2">
            {receipts.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="file"
                  className={`border p-1 flex-1 ${!file && errorMsg ? 'border-red-600':''}`}
                  onChange={e=>{
                    const next = [...receipts]
                    next[idx] = e.target.files?.[0] || null
                    setReceipts(next)
                  }}
                />
                {receipts.length > 1 && (
                  <button
                    type="button"
                    onClick={()=>{
                      const next = receipts.filter((_, i) => i !== idx)
                      setReceipts(next.length ? next : [null])
                    }}
                    className="px-2 py-1 text-sm border rounded"
                  >Hapus</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 bg-green-600 text-white rounded">Simpan</button>
          <button type="button" onClick={()=>nav('/')} className="px-3 py-2 border rounded">Batal</button>
        </div>
      </form>
      </div>
    </div>
  )
}
