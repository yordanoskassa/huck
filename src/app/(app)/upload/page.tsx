'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState('dat_screenshot')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    parsed_data: unknown
    created_loads: unknown[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  })

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_type', uploadType)

    try {
      const res = await fetch('/api/parse-image', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Upload & Parse</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload area */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Document Type</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="dat_screenshot">DAT Screenshot</option>
              <option value="bol">Bill of Lading</option>
              <option value="rate_confirmation">Rate Confirmation</option>
            </select>
          </div>

          <div
            {...getRootProps()}
            className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
            }`}
          >
            <input {...getInputProps()} />
            <FileImage className="mx-auto h-10 w-10 text-gray-500 mb-3" />
            {isDragActive ? (
              <p className="text-sm text-blue-400">Drop the image here</p>
            ) : (
              <>
                <p className="text-sm text-gray-400">Drag & drop an image, or click to browse</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG, WebP</p>
              </>
            )}
          </div>

          {preview && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
              <img src={preview} alt="Preview" className="rounded-lg w-full max-h-64 object-contain" />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-gray-400">{file?.name}</p>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {loading ? 'Parsing with AI...' : 'Upload & Parse'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/20 p-5">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.created_loads && (result.created_loads as unknown[]).length > 0 && (
                <div className="rounded-xl border border-green-800 bg-green-900/20 p-5">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {(result.created_loads as unknown[]).length} load(s) created
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Extracted Data</h3>
                <pre className="text-xs text-gray-300 overflow-auto max-h-96 bg-gray-800/50 rounded-lg p-4">
                  {JSON.stringify(result.parsed_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
