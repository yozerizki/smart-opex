import React, { useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'

export default function CreateActivity(){
  const [itemName, setItemName] = useState('')
  const [manualTotalInput, setManualTotalInput] = useState('')
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
  const [activeInfo, setActiveInfo] = useState<'' | 'receipt' | 'activity' | 'supporting'>('')
  const nav = useNavigate()
  const [receipts, setReceipts] = useState<(File | null)[]>([null])
  const [activityDocuments, setActivityDocuments] = useState<(File | null)[]>([null])
  const [supportingDocuments, setSupportingDocuments] = useState<(File | null)[]>([null])

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

  function formatThousand(value: number) {
    return value.toLocaleString('id-ID')
  }

  function parseDigits(value: string) {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    return Number(digits)
  }

  async function submit(e:any){
    e.preventDefault()
    // validate date not in future
    if(transactionDate > todayStr){
      setErrorMsg('Tanggal transaksi tidak boleh di masa depan.')
      return
    }
    const parsedManualTotal = parseDigits(manualTotalInput)

    // validate required fields
    if(!itemName || parsedManualTotal === '' || !groupViewId || !transactionDate || !recipientName){
      setErrorMsg('Data harus diisi lengkap')
      return
    }
    if (role !== 'pic' && !districtId) {
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
    const selectedActivityDocuments = activityDocuments.filter(Boolean) as File[]
    if(selectedActivityDocuments.length === 0){
      setErrorMsg('Harap unggah minimal 1 file Dokumentasi Kegiatan.')
      return
    }
    const selectedSupportingDocuments = supportingDocuments.filter(Boolean) as File[]
    if(selectedSupportingDocuments.length === 0){
      setErrorMsg('Harap unggah minimal 1 file Bukti Pendukung.')
      return
    }
    try{
      const fd = new FormData()
      fd.append('item_name', itemName)
      fd.append('manual_total', String(parsedManualTotal))
      fd.append('group_view_id', String(groupViewId))
      fd.append('transaction_date', transactionDate)
      fd.append('recipient_name', recipientName)
      if (role !== 'pic' && districtId) fd.append('district_id', String(districtId))
      selectedReceipts.forEach((file) => fd.append('receipts', file))
      selectedActivityDocuments.forEach((file) => fd.append('activity_documents', file))
      selectedSupportingDocuments.forEach((file) => fd.append('supporting_documents', file))

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
        <input
          className={`w-full p-2 border ${manualTotalInput === '' && errorMsg ? 'border-red-600' : ''}`}
          placeholder="Pengeluaran"
          type="text"
          inputMode="numeric"
          value={manualTotalInput}
          onFocus={(e) => {
            if (e.currentTarget.value === '0' || e.currentTarget.value === '0,00') {
              setManualTotalInput('')
            }
          }}
          onChange={e=>{
            const parsed = parseDigits(e.target.value)
            setManualTotalInput(parsed === '' ? '' : formatThousand(parsed))
          }}
        />
        <label className="block text-sm">District</label>
        {role !== 'pic' ? (
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
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Nota (minimal 1, maksimal 10)</h4>
              <button
                type="button"
                className="text-sm text-blue-600"
                onClick={() => setActiveInfo(activeInfo === 'receipt' ? '' : 'receipt')}
                aria-label="Info nota"
              >
                ⓘ
              </button>
            </div>
            <button
              type="button"
              onClick={()=>{
                if (receipts.length >= 10) return
                setReceipts([...receipts, null])
              }}
              className="px-2 py-1 text-sm border rounded"
            >Tambah Nota</button>
          </div>
          {activeInfo === 'receipt' && (
            <div className="mt-2 p-2 text-sm border rounded bg-blue-50 text-gray-700 space-y-1">
              <div>a. File pdf, maksimal 1 invoice per halaman</div>
              <div>b. Gunakan satu saja lembar/screenshot slip pembayaran akhir yang sudah termasuk biaya-biaya (biaya layanan/transfer/top up)</div>
              <div>c. Pastikan berkas invoice utuh dan jelas</div>
              <div>d. Orientasi Asli, Tidak dirotasi, biarkan mendatar</div>
              <div>e. Berkas berupa Laporan pertanggung jawaban dengan tabel rekapitulasi, dapat diproses.</div>
            </div>
          )}
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
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Dokumentasi Kegiatan (minimal 1)</h4>
              <button
                type="button"
                className="text-sm text-blue-600"
                onClick={() => setActiveInfo(activeInfo === 'activity' ? '' : 'activity')}
                aria-label="Info dokumentasi kegiatan"
              >
                ⓘ
              </button>
            </div>
            <button
              type="button"
              onClick={()=>setActivityDocuments([...activityDocuments, null])}
              className="px-2 py-1 text-sm border rounded"
            >Tambah File</button>
          </div>
          {activeInfo === 'activity' && (
            <div className="mt-2 p-2 text-sm border rounded bg-blue-50 text-gray-700">
              Unggah file dokumentasi kegiatan dalam format JPG/JPEG/PNG atau PDF.
            </div>
          )}
          <div className="mt-2 space-y-2">
            {activityDocuments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className={`border p-1 flex-1 ${!file && errorMsg ? 'border-red-600':''}`}
                  onChange={e=>{
                    const next = [...activityDocuments]
                    next[idx] = e.target.files?.[0] || null
                    setActivityDocuments(next)
                  }}
                />
                <button
                  type="button"
                  onClick={()=>{
                    const next = activityDocuments.filter((_, i) => i !== idx)
                    setActivityDocuments(next.length ? next : [null])
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >Hapus</button>
              </div>
            ))}
            {activityDocuments.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {activityDocuments.filter(Boolean).map((f) => (f as File).name).join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Bukti / Dokumentasi Pendukung (minimal 1)</h4>
              <button
                type="button"
                className="text-sm text-blue-600"
                onClick={() => setActiveInfo(activeInfo === 'supporting' ? '' : 'supporting')}
                aria-label="Info dokumentasi pendukung"
              >
                ⓘ
              </button>
            </div>
            <button
              type="button"
              onClick={()=>setSupportingDocuments([...supportingDocuments, null])}
              className="px-2 py-1 text-sm border rounded"
            >Tambah File</button>
          </div>
          {activeInfo === 'supporting' && (
            <div className="mt-2 p-2 text-sm border rounded bg-blue-50 text-gray-700">
              Unggah file bukti/dokumentasi pendukung dalam format JPG/JPEG/PNG atau PDF.
            </div>
          )}
          <div className="mt-2 space-y-2">
            {supportingDocuments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className={`border p-1 flex-1 ${!file && errorMsg ? 'border-red-600':''}`}
                  onChange={e=>{
                    const next = [...supportingDocuments]
                    next[idx] = e.target.files?.[0] || null
                    setSupportingDocuments(next)
                  }}
                />
                <button
                  type="button"
                  onClick={()=>{
                    const next = supportingDocuments.filter((_, i) => i !== idx)
                    setSupportingDocuments(next.length ? next : [null])
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >Hapus</button>
              </div>
            ))}
            {supportingDocuments.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {supportingDocuments.filter(Boolean).map((f) => (f as File).name).join(', ')}
              </div>
            )}
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
