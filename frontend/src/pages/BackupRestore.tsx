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

      const disposition = res.headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^";]+)"?/i)
      const filename = match?.[1] || 'smartopex-backup.tar.gz'

      const blob = new Blob([res.data], { type: 'application/gzip' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      await fetchStatus()
      alert('Backup berhasil dibuat dan diunduh')
    } catch (err: any) {
      const text = await safeReadBlobError(err?.response?.data)
      alert(text || err?.response?.data?.message || err?.message || 'Gagal backup')
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
          onClick={handleRestore}
          disabled={loading || !status?.hasBackup}
          className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
        >
          restore
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
