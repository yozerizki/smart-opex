import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function EngineAI(){
  const [currentFileName, setCurrentFileName] = useState('')
  const [engineFiles, setEngineFiles] = useState<Array<{ fileName: string; isActive?: boolean }>>([])
  const [selectedFileName, setSelectedFileName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'upload' | 'previous'>('upload')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    async function fetchEngineData(){
      try{
        const [currentRes, filesRes] = await Promise.all([
          api.get('/ocr/engine'),
          api.get('/ocr/engine/files'),
        ])
        const current = currentRes.data?.fileName || '-'
        const files = filesRes.data?.files || []
        setCurrentFileName(current)
        setEngineFiles(files)
        const active = files.find((item: any) => item.isActive)
        setSelectedFileName(active?.fileName || '')
      }catch(e){
        setCurrentFileName('-')
        setEngineFiles([])
        setSelectedFileName('')
      }
    }
    fetchEngineData()
  }, [])

  async function saveAndExit(){
    setLoading(true)
    try{
      if (mode === 'previous') {
        if (!selectedFileName) {
          alert('Pilih file engine terlebih dahulu')
          return
        }
        await api.patch('/ocr/engine/active', { fileName: selectedFileName })
      } else {
        if (!file) {
          alert('Pilih file .py terlebih dahulu')
          return
        }
        if (!file.name.toLowerCase().endsWith('.py')) {
          alert('File harus berekstensi .py')
          return
        }
        const fd = new FormData()
        fd.append('engine', file)
        await api.post('/ocr/engine', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      nav('/')
    }catch(err:any){
      alert(err?.response?.data?.message || 'Gagal menyimpan engine AI')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-2xl bg-white p-6 rounded shadow">
        <h3 className="text-lg font-medium mb-4">Engine AI</h3>
        <div className="mb-3">
          <div className="text-sm text-gray-600">File aktif saat ini</div>
          <div className="font-medium">{currentFileName || '-'}</div>
        </div>
        {mode === 'upload' ? (
          <div className="mb-4">
            <label className="block text-sm mb-1">Upload file engine (.py)</label>
            <input
              type="file"
              accept=".py"
              className="w-full p-2 border"
              onChange={e=>setFile(e.target.files?.[0] || null)}
            />
            {file && <div className="text-sm text-gray-600 mt-1">{file.name}</div>}
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm mb-1">Pilih file engine sebelumnya</label>
            <select
              className="w-full p-2 border"
              value={selectedFileName}
              onChange={e=>setSelectedFileName(e.target.value)}
            >
              <option value="">-- pilih file --</option>
              {engineFiles.map(item => (
                <option key={item.fileName} value={item.fileName}>
                  {item.fileName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={saveAndExit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">Simpan</button>
          <button
            onClick={() => setMode(mode === 'upload' ? 'previous' : 'upload')}
            disabled={loading}
            className="px-4 py-2 border rounded"
          >
            {mode === 'upload' ? 'Gunakan File Engine Sebelumnya' : 'Upload File Engine'}
          </button>
          <button onClick={()=>nav('/')} className="px-4 py-2 border rounded">Keluar</button>
        </div>
      </div>
    </div>
  )
}
