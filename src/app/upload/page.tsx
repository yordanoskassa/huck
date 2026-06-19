'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon, Loader2, CheckCircle, AlertCircle, ArrowRight, Zap, ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'

interface ParsedLoad {
  origin_city: string
  origin_state: string
  dest_city: string
  dest_state: string
  posted_rate: number
  rate_per_mile: number
  broker_name: string
  equipment_type: string
  miles: number
  pickup_date: string
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedLoads, setParsedLoads] = useState<ParsedLoad[]>([])
  const [createdCount, setCreatedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return
    const f = accepted[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setParsedLoads([])
    setCreatedCount(0)
    setError(null)
    setDone(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    multiple: false,
  })

  async function handleExtract() {
    if (!file) return
    setParsing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_type', 'dat_screenshot')

      const res = await fetch('/api/parse-image', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to parse image')
        return
      }

      if (Array.isArray(data.parsed_data)) {
        setParsedLoads(data.parsed_data as ParsedLoad[])
      }
      setCreatedCount(data.created_loads?.length || 0)
      setDone(true)
    } catch (err) {
      setError('Failed: ' + String(err))
    } finally {
      setParsing(false)
    }
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    setParsedLoads([])
    setCreatedCount(0)
    setError(null)
    setDone(false)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">HUCK</h1>
              <p className="text-[11px] text-gray-400 -mt-0.5">Screenshot Upload &middot; Vision AI</p>
            </div>
          </div>
          <a href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">Upload DAT Screenshot</h2>
          <p className="text-sm text-gray-500 mt-1">
            Screenshot a load listing from DAT One. Gemini Vision AI extracts the load data and adds it directly to HUCK.
          </p>
        </div>

        {/* Upload area */}
        {!file && (
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
              isDragActive
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/50'
            )}
          >
            <input {...getInputProps()} />
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Upload className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {isDragActive ? 'Drop screenshot here...' : 'Drag & drop a DAT screenshot'}
            </p>
            <p className="text-xs text-gray-400 mt-1">or click to browse &middot; PNG, JPG, WebP</p>
          </div>
        )}

        {/* Preview + Extract */}
        {file && !done && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
              </div>
              {preview && (
                <div className="p-4 flex justify-center bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Screenshot preview" className="max-h-80 rounded-lg shadow-sm" />
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={parsing}
              className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 transition-all active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 disabled:opacity-60"
            >
              {parsing ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Gemini is extracting load data...</>
              ) : (
                <><Zap className="h-5 w-5" /> Extract Loads with Vision AI</>
              )}
            </button>
          </div>
        )}

        {/* Results */}
        {done && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-800">
                  {createdCount} load{createdCount !== 1 ? 's' : ''} extracted and added to HUCK
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Vision AI parsed your screenshot and created load entries</p>
              </div>
            </div>

            {parsedLoads.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extracted Loads</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {parsedLoads.map((load, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">
                          {load.origin_city}, {load.origin_state}
                        </span>
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                        <span className="text-sm font-bold text-gray-900">
                          {load.dest_city}, {load.dest_state}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {load.equipment_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">{load.miles} mi</span>
                        <span className="font-black text-gray-900">${Number(load.posted_rate).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Source Screenshot</p>
                </div>
                <div className="p-4 flex justify-center bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Source" className="max-h-60 rounded-lg shadow-sm opacity-75" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all"
              >
                Upload Another
              </button>
              <a
                href="/"
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all text-center"
              >
                Back to HUCK Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
