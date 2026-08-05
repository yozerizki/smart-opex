import { useEffect, useState } from 'react'
import api from '../api'

type BackupStatus = {
  hasBackup: boolean
  fileName: string
  sizeBytes: number
  updatedAt: string | null
}

export default function BackupRestore() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoreUploadFile, setRestoreUploadFile] = useState<File | null>(null)

  function triggerBackupDownload(blobData: any, contentDisposition?: string) {
    const disposition = contentDisposition || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    const filename = match?.[1] || 'smartopex-backup.tar.gz'

    const blob = new Blob([blobData], { type: 'application/gzip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function fetchStatus() {
    const res = await api.get('/backup-restore/status')
    setStatus(res.data)
  }

  useEffect(() => {
    fetchStatus().catch(() => {
      alert('Gagal memuat status backup')
    })
  }, [])

  async function handleBackup() {
    if (!window.confirm('Yakin ingin membuat file backup terbaru? File backup lama akan diganti.')) return

    setLoading(true)
    try {
      const res = await api.post(
        '/backup-restore/backup',
        {},
        { responseType: 'blob' },
      )

      triggerBackupDownload(res.data, res.headers['content-disposition'])

      await fetchStatus()
      alert('Backup berhasil dibuat dan diunduh')
    } catch (err: any) {
      const text = await safeReadBlobError(err?.response?.data)
      alert(text || err?.response?.data?.message || err?.message || 'Gagal backup')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadExistingBackup() {
    if (!status?.hasBackup) {
      alert('Belum ada file backup untuk diunduh')
      return
    }

    setLoading(true)
    try {
      const res = await api.get('/backup-restore/download', { responseType: 'blob' })
      triggerBackupDownload(res.data, res.headers['content-disposition'])
      alert('File backup berhasil diunduh')
    } catch (err: any) {
      const text = await safeReadBlobError(err?.response?.data)
      alert(text || err?.response?.data?.message || err?.message || 'Gagal mengunduh backup')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore() {
    if (!status?.hasBackup) {
      alert('Belum ada file backup untuk restore')
      return
    }

    const confirmMessage = [
      'PERINGATAN: proses restore akan menghapus/mengganti data yang ada saat ini dengan data dari file backup.',
      'Perubahan ini tidak bisa dibatalkan.',
      'Lanjutkan restore sekarang?'
    ].join('\n\n')

    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    try {
      await api.post('/backup-restore/restore', {})
      await fetchStatus()
      alert('Restore berhasil. Silakan refresh halaman dashboard.')
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Gagal restore')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestoreFromUpload() {
    if (!restoreUploadFile) {
      alert('Pilih file backup .tar.gz terlebih dahulu')
      return
    }

    const lowerName = restoreUploadFile.name.toLowerCase()
    if (!lowerName.endsWith('.tar.gz')) {
      alert('File backup harus berekstensi .tar.gz')
      return
    }

    const confirmMessage = [
      'PERINGATAN: restore dari file upload akan menghapus/mengganti data saat ini.',
      'Perubahan ini tidak bisa dibatalkan.',
      'Lanjutkan restore dari file upload sekarang?'
    ].join('\n\n')

    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', restoreUploadFile)

      await api.post('/backup-restore/restore-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setRestoreUploadFile(null)
      await fetchStatus()
      alert('Restore dari file upload berhasil. Silakan refresh halaman dashboard.')
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Gagal restore dari file upload')
    } finally {
      setLoading(false)
    }
  }

  const sizeMb = status ? (status.sizeBytes / (1024 * 1024)).toFixed(2) : '0.00'

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Backup/Restore</h2>
      <div className="rounded border p-4 bg-white space-y-2 text-sm">
        <div>Status file backup: {status?.hasBackup ? 'Tersedia' : 'Belum ada'}</div>
        <div>Nama file: {status?.fileName || '-'}</div>
        <div>Ukuran: {status?.hasBackup ? `${sizeMb} MB` : '-'}</div>
        <div>Update terakhir: {status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : '-'}</div>
        <div className="text-xs text-gray-500">Maksimal satu file backup disimpan di server. Backup baru akan menggantikan file sebelumnya.</div>
      </div>

      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Peringatan Restore</div>
        <div>
          Saat tombol restore ditekan dan dikonfirmasi, data saat ini akan dihapus/diganti dengan data dari backup.
          Pastikan file backup yang tersedia memang benar sebelum melanjutkan.
        </div>
      </div>

      <div className="rounded border p-4 bg-white space-y-3 text-sm">
        <div className="font-semibold">Restore dari File Upload</div>
        <input
          type="file"
          accept=".tar.gz,application/gzip"
          disabled={loading}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null
            setRestoreUploadFile(selected)
          }}
          className="block w-full text-sm"
        />
        <div className="text-xs text-gray-500">
          File harus berformat backup SmartOPEX dengan ekstensi .tar.gz.
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleBackup}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        >
          backup
        </button>

        <button
          type="button"
          onClick={handleDownloadExistingBackup}
          disabled={loading || !status?.hasBackup}
          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
        >
          download backup
        </button>

        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || !status?.hasBackup}
          className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
        >
          restore
        </button>

        <button
          type="button"
          onClick={handleRestoreFromUpload}
          disabled={loading || !restoreUploadFile}
          className="px-4 py-2 rounded bg-rose-700 text-white disabled:opacity-60"
        >
          restore dari upload
        </button>
      </div>
    </div>
  )
}

async function safeReadBlobError(value: any) {
  if (!value || typeof Blob === 'undefined' || !(value instanceof Blob)) return null
  try {
    const text = await value.text()
    try {
      const json = JSON.parse(text)
      return json?.message || null
    } catch {
      return text || null
    }
  } catch {
    return null
  }
}
