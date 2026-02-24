import React, { useEffect, useState } from 'react'
import api from '../api'
import { useParams, useNavigate } from 'react-router-dom'

export default function ActivityDetail(){
  const { id } = useParams()
  const [activity, setActivity] = useState<any>(null)
  const [review, setReview] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [viewedIds, setViewedIds] = useState<number[]>([])
  const [itemName, setItemName] = useState('')
  const [manualTotal, setManualTotal] = useState<number | ''>('')
  const [groupViewId, setGroupViewId] = useState<number | ''>('')
  const [groupViews, setGroupViews] = useState<any[]>([])
  const [recipientName, setRecipientName] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [districts, setDistricts] = useState<any[]>([])
  const [role, setRole] = useState<string>('')
  const [newReceipts, setNewReceipts] = useState<(File | null)[]>([])
  const [newDocuments, setNewDocuments] = useState<(File | null)[]>([])
  const [deletedReceiptIds, setDeletedReceiptIds] = useState<number[]>([])
  const [deletedDocumentIds, setDeletedDocumentIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(()=>{ if(id) fetchReview() },[id])
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
      try{
        const res = await api.get('/group-views')
        setGroupViews(res.data)
      }catch(e){
        // ignore
      }
    }
    bootstrap()
  },[])

  const manualNum = manualTotal === '' ? null : Number(manualTotal)
  const ocrNum = review ? Number(review.total_ocr || 0) : 0
  const amountsEqual = manualNum !== null && manualNum === ocrNum
  const allReceiptsViewed = !!review?.receipts?.length && review.receipts.every((r:any) => viewedIds.includes(r.id))
  const hasPendingOcr = !!review?.receipts?.some((r:any) => r.ocr_detected_total === null || r.ocr_detected_total === undefined)

  async function fetchReview(){
    try{
      // use the full item endpoint which includes transaction_date; compute review fields locally
      const res = await api.get(`/opex/${id}`)
      const data = res.data
      const receipts = (data.opex_receipts || []).map((r:any)=>({ id: r.id, file_path: r.file_path, ocr_detected_total: r.ocr_detected_total }))
      const reviewObj = {
        id: data.id,
        item_name: data.item_name,
        recipient_name: data.recipient_name,
        manual_total: data.amount,
        transaction_date: data.transaction_date ? String(data.transaction_date).split('T')[0] : '',
        receipts,
        documents: data.documents || [],
        total_ocr: data.total_ocr ?? 0,
        status: data.status,
        district_id: data.district_id,
        district_name: data.districts?.name,
        group_view_id: data.group_view_id,
        group_view_name: data.group_views?.name,
      }
      setReview(reviewObj)
      // populate edit fields
      setItemName(reviewObj.item_name || '')
      setManualTotal(reviewObj.manual_total ?? '')
      setGroupViewId(data.group_view_id || data.group_views?.id || '')
      setRecipientName(reviewObj.recipient_name || '')
      setTransactionDate(reviewObj.transaction_date || '')
      setDistrictId(data.district_id || '')
      setNewReceipts([])
      setNewDocuments([])
      setDeletedReceiptIds([])
      setDeletedDocumentIds([])
      setViewedIds([])
    }catch(e){
      console.error(e)
    }
  }

  useEffect(() => {
    if (!review || !hasPendingOcr) return
    const interval = setInterval(() => {
      fetchReview()
    }, 10000)
    return () => clearInterval(interval)
  }, [review, hasPendingOcr])

  return (
    <div>
      {!review ? <div>Memuat...</div> : (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold">{review.item_name}</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium">Nama Kegiatan</label>
              <input disabled={!editing} className={`w-full p-2 border ${!editing ? 'bg-gray-50' : ''}`} value={itemName} onChange={e=>setItemName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-sm font-medium">Group View</label>
                {editing ? (
                  <select className="w-full p-2 border" value={groupViewId} onChange={e=>setGroupViewId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Pilih group view</option>
                    {groupViews.map((g:any)=> (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border bg-gray-50">{groupViews.find((g:any)=>g.id === groupViewId)?.name || review?.group_view_name || '-'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">District</label>
                {role === 'verifikator' && editing ? (
                  <select className="w-full p-2 border" value={districtId} onChange={e=>setDistrictId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Pilih district</option>
                    {districts.map((d:any)=> (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border bg-gray-50">{review?.district_name || districts.find((d:any)=>d.id === districtId)?.name || '-'}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Tanggal Transaksi</label>
                {!editing ? (
                  <div className="p-2 border bg-gray-50">{transactionDate}</div>
                ) : (
                  <input type="date" className={`w-full p-2 border ${!editing ? 'bg-gray-50' : ''}`} value={transactionDate} onChange={e=>setTransactionDate(e.target.value)} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Nama Toko / Penerima</label>
                <input disabled={!editing} className={`w-full p-2 border ${!editing ? 'bg-gray-50' : ''}`} value={recipientName} onChange={e=>setRecipientName(e.target.value)} />
              </div>
            </div>
            <div className="mt-4">
              <div className="p-4 border rounded-lg bg-white shadow-sm">
                <div className="text-sm text-gray-600 mb-2">Perbandingan</div>
                {(() => {
                  const pengeluaranPanelClass = amountsEqual ? 'p-3 rounded-md bg-green-50' : 'p-3 rounded-md bg-yellow-50'
                  const pengeluaranLabelClass = amountsEqual ? 'block text-sm font-medium text-green-800' : 'block text-sm font-medium text-yellow-800'
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className={pengeluaranPanelClass}>
                        <label className={pengeluaranLabelClass}>Total (PIC)</label>
                        <input disabled={!editing} type="number" className={`w-full p-2 border bg-transparent`} value={manualTotal as any} onChange={e=>setManualTotal(Number(e.target.value)||'')} />
                      </div>
                      <div className="p-3 rounded-md bg-green-50">
                        <label className="block text-sm font-medium text-green-800">Total (AI)</label>
                        <div className="p-2 border bg-green-50 text-right font-medium">{review.total_ocr}</div>
                        {hasPendingOcr && (
                          <div className="text-xs text-green-700 mt-1">OCR sedang diproses...</div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-3">
                  <div><strong>Status:</strong> {review.status}</div>
                  {review.status === 'PERLU_REVIEW' && allReceiptsViewed && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="text-sm text-gray-600">invoice sudah benar / AI salah baca?</div>
                      <button onClick={async ()=>{
                        if(!confirm("Tandai telah di review? status data akan berubah!")) return
                        try{
                          await api.patch(`/opex/${id}`, { status: 'TELAH_DIREVIEW' })
                          await fetchReview()
                          alert('Status diperbarui menjadi TELAH_DIREVIEW')
                        }catch(err:any){
                          alert(err?.response?.data?.message || 'Gagal memperbarui status')
                        }
                      }} className="px-2 py-1 bg-green-100 text-sm border rounded">tandai 'telah direview'</button>
                    </div>
                  )}
                  {review.status === 'TELAH_DIREVIEW' && !amountsEqual && (
                    <div className="mt-2">
                      <button onClick={async ()=>{
                        if(!confirm("Kembalikan status ke 'Perlu Review'?")) return
                        try{
                          await api.patch(`/opex/${id}`, { status: 'PERLU_REVIEW' })
                          await fetchReview()
                          alert("Status dikembalikan ke PERLU_REVIEW")
                        }catch(err:any){
                          alert(err?.response?.data?.message || 'Gagal memperbarui status')
                        }
                      }} className="px-2 py-1 bg-yellow-100 text-sm border rounded">kembalikan ke 'Perlu Review'</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>

            <div className="mt-4">
            <h4 className="font-medium">File Nota</h4>
            <ul>
              {review.receipts.map((d:any)=> (
                <li key={d.id} className={`border p-2 my-1 flex justify-between items-center ${deletedReceiptIds.includes(d.id) ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="font-medium">{d.file_path}</div>
                    <div>OCR: {d.ocr_detected_total ?? '-'}</div>
                  </div>
                  <div>
                    {(() => {
                      const open = async () => {
                        try {
                          const rawPath = String(d.file_path || '')
                          const uploadsIdx = rawPath.lastIndexOf('/uploads/')
                          const relativePath =
                            uploadsIdx >= 0
                              ? rawPath.slice(uploadsIdx)
                              : rawPath.startsWith('/uploads/')
                                ? rawPath
                                : rawPath.startsWith('uploads/')
                                  ? `/${rawPath}`
                                  : `/uploads/receipts/${rawPath.split('/').pop() || ''}`
                          const fileUrl = `${api.defaults.baseURL}${relativePath}`
                          window.open(fileUrl, '_blank')
                        } catch (error) {
                          alert('Gagal membuka file nota')
                        }
                        if(!viewedIds.includes(d.id)) setViewedIds([...viewedIds, d.id])
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <button onClick={open} className="px-3 py-1 border rounded">Lihat Nota</button>
                          {editing && !deletedReceiptIds.includes(d.id) && (
                            <button onClick={()=>setDeletedReceiptIds([...deletedReceiptIds, d.id])} className="px-3 py-1 border rounded text-red-600">Hapus</button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </li>
              ))}
            </ul>
            {editing && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Tambah Nota (maks 10)</div>
                  <button
                    type="button"
                    onClick={()=>{
                      if (newReceipts.length + review.receipts.length - deletedReceiptIds.length >= 10) return
                      setNewReceipts([...newReceipts, null])
                    }}
                    className="px-2 py-1 text-sm border rounded"
                  >Tambah Nota</button>
                </div>
                <div className="mt-2 space-y-2">
                  {newReceipts.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="file"
                        className="border p-1 flex-1"
                        onChange={e=>{
                          const next = [...newReceipts]
                          next[idx] = e.target.files?.[0] || null
                          setNewReceipts(next)
                        }}
                      />
                      <button
                        type="button"
                        onClick={()=>{
                          const next = newReceipts.filter((_, i) => i !== idx)
                          setNewReceipts(next)
                        }}
                        className="px-2 py-1 text-sm border rounded"
                      >Hapus</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-medium">Dokumentasi Kegiatan</h4>
              {(review.documents || []).length === 0 ? (
                <div className="text-sm text-gray-500">Tidak ada dokumentasi</div>
              ) : (
                <ul>
                  {review.documents.map((d:any)=> (
                    <li key={d.id} className={`border p-2 my-1 flex justify-between items-center ${deletedDocumentIds.includes(d.id) ? 'opacity-50' : ''}`}>
                      <div className="font-medium">{d.file_path}</div>
                      <div className="flex items-center gap-2">
                        <a
                          className="text-blue-600 underline"
                          href={`${((import.meta as any).env?.VITE_API_URL || 'http://localhost:3000')}/${d.file_path.replace(/^\/+/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lihat
                        </a>
                        {editing && !deletedDocumentIds.includes(d.id) && (
                          <button onClick={()=>setDeletedDocumentIds([...deletedDocumentIds, d.id])} className="px-2 py-1 text-sm border rounded text-red-600">Hapus</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {editing && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Tambah Dokumentasi</div>
                    <button
                      type="button"
                      onClick={()=>setNewDocuments([...newDocuments, null])}
                      className="px-2 py-1 text-sm border rounded"
                    >Tambah File</button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {newDocuments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="border p-1 flex-1"
                          onChange={e=>{
                            const next = [...newDocuments]
                            next[idx] = e.target.files?.[0] || null
                            setNewDocuments(next)
                          }}
                        />
                        <button
                          type="button"
                          onClick={()=>{
                            const next = newDocuments.filter((_, i) => i !== idx)
                            setNewDocuments(next)
                          }}
                          className="px-2 py-1 text-sm border rounded"
                        >Hapus</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
            <div className="mt-4 flex items-center justify-end space-x-2">
            {!editing ? (
              <>
                <button onClick={()=>setEditing(true)} className="px-4 py-2 bg-yellow-400 text-black rounded">Edit</button>
                <button onClick={()=>navigate('/')} className="px-4 py-2 bg-green-600 text-white rounded">OK</button>
              </>
            ) : (
              <>
                <button onClick={async ()=>{
                  if (saving) return
                  setSaving(true)
                  try{
                    const currentCount = review.receipts.length
                    const addCount = newReceipts.filter(Boolean).length
                    const deleteCount = deletedReceiptIds.length
                    const remaining = currentCount - deleteCount + addCount
                    if (remaining <= 0) {
                      alert('Minimal 1 nota harus ada')
                      return
                    }
                    if (remaining > 10) {
                      alert('Maksimal 10 nota per kegiatan')
                      return
                    }
                    const payload:any = { item_name: itemName, group_view_id: groupViewId, transaction_date: transactionDate, recipient_name: recipientName, manual_total: manualTotal }
                    if (role === 'verifikator' && districtId) payload.district_id = districtId
                    await api.patch(`/opex/${id}`, payload)

                    const filesToAdd = newReceipts.filter(Boolean) as File[]
                    const docsToAdd = newDocuments.filter(Boolean) as File[]
                    const shouldDeleteFirst = currentCount + addCount > 10

                    if (shouldDeleteFirst) {
                      for (const rid of deletedReceiptIds) {
                        await api.delete(`/opex/${id}/receipts/${rid}`)
                      }
                      for (const docId of deletedDocumentIds) {
                        await api.delete(`/opex/${id}/documents/${docId}`)
                      }
                      if (filesToAdd.length) {
                        const fd = new FormData()
                        filesToAdd.forEach((f) => fd.append('receipts', f))
                        await api.post(`/opex/${id}/receipts`, fd, { headers: {'Content-Type': 'multipart/form-data'} })
                      }
                      if (docsToAdd.length) {
                        const fd = new FormData()
                        docsToAdd.forEach((f) => fd.append('documents', f))
                        await api.post(`/opex/${id}/documents`, fd, { headers: {'Content-Type': 'multipart/form-data'} })
                      }
                    } else {
                      if (filesToAdd.length) {
                        const fd = new FormData()
                        filesToAdd.forEach((f) => fd.append('receipts', f))
                        await api.post(`/opex/${id}/receipts`, fd, { headers: {'Content-Type': 'multipart/form-data'} })
                      }
                      if (docsToAdd.length) {
                        const fd = new FormData()
                        docsToAdd.forEach((f) => fd.append('documents', f))
                        await api.post(`/opex/${id}/documents`, fd, { headers: {'Content-Type': 'multipart/form-data'} })
                      }
                      for (const rid of deletedReceiptIds) {
                        await api.delete(`/opex/${id}/receipts/${rid}`)
                      }
                      for (const docId of deletedDocumentIds) {
                        await api.delete(`/opex/${id}/documents/${docId}`)
                      }
                    }

                    await fetchReview()
                    setEditing(false)
                    alert('Perubahan tersimpan')
                  }catch(err:any){
                    alert(err?.response?.data?.message || 'Gagal menyimpan')
                  }finally{
                    setSaving(false)
                  }
                }} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">Simpan</button>
                <button onClick={()=>{
                  if (saving) return
                  // cancel edits: revert to review values
                  setItemName(review.item_name || '')
                  setManualTotal(review.manual_total ?? '')
                  setGroupViewId(review.group_view_id || '')
                  setRecipientName(review.recipient_name || '')
                  if(review.transaction_date) setTransactionDate(review.transaction_date)
                  setDeletedReceiptIds([])
                  setDeletedDocumentIds([])
                  setNewReceipts([])
                  setNewDocuments([])
                  setEditing(false)
                }} disabled={saving} className="px-4 py-2 border rounded disabled:opacity-60">Batal</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
