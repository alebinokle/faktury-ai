'use client'

import { useState } from 'react'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  const handleProcess = async () => {
    if (!file) {
      alert('Najpierw wybierz plik.')
      return
    }

    try {
      setLoading(true)
      setResult('')

      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
        setDownloadUrl('')
      }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      const text = await res.text()

      if (!res.ok) {
        setResult(text || 'Wystąpił błąd.')
        return
      }

      setResult(text)

      const blob = new Blob([text], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    } catch (error) {
      console.error(error)
      alert('Wystąpił błąd podczas wysyłania pliku.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-lg p-8 border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Przetwarzanie faktur do KSeF XML
        </h1>
        <p className="text-gray-600 mb-6">
          Wgraj fakturę w PDF albo jako zdjęcie. System odczyta dokument i zwróci XML.
        </p>

        <div className="space-y-4">
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] ?? null
              setFile(selectedFile)
            }}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:text-white hover:file:opacity-90"
          />

          {file && (
            <div className="rounded-xl bg-gray-100 p-4 text-sm text-gray-800">
              <strong>Wybrano:</strong> {file.name}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Przetwarzanie...' : 'Przetwórz do XML'}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download="faktura_ksef.xml"
              className="block w-full rounded-xl bg-green-600 px-4 py-3 text-white font-medium text-center hover:opacity-90 transition"
            >
              Pobierz XML
            </a>
          )}

          {result && (
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-100 p-4 text-sm text-gray-800 overflow-auto max-h-[500px]">
              {result}
            </pre>
          )}
        </div>
      </div>
    </main>
  )
}