'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon, Loader2, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/shell/app-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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

const DOC_TYPES: Record<string, string> = {
  dat_screenshot: 'DAT Screenshot',
  bol: 'Bill of Lading',
  rate_confirmation: 'Rate Confirmation',
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState('dat_screenshot')
  const [parsing, setParsing] = useState(false)
  const [parsedLoads, setParsedLoads] = useState<ParsedLoad[]>([])
  const [createdCount, setCreatedCount] = useState(0)
  const [done, setDone] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return
    const f = accepted[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setParsedLoads([])
    setCreatedCount(0)
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

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_type', uploadType)

      const res = await fetch('/api/parse-image', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse image')
        return
      }

      if (Array.isArray(data.parsed_data)) {
        setParsedLoads(data.parsed_data as ParsedLoad[])
      }
      setCreatedCount(data.created_loads?.length || 0)
      setDone(true)
    } catch (err) {
      toast.error('Failed: ' + String(err))
    } finally {
      setParsing(false)
    }
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    setParsedLoads([])
    setCreatedCount(0)
    setDone(false)
  }

  return (
    <AppShell title="Upload">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">Upload DAT Screenshot</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Screenshot a load listing from DAT One. Gemini Vision AI extracts the load data and adds it directly to HUCK.
          </p>
        </div>

        {/* Document type */}
        {!done && (
          <div className="mb-4 space-y-1.5">
            <Label htmlFor="doc-type">Document Type</Label>
            <Select value={uploadType} onValueChange={(value) => value && setUploadType(value)}>
              <SelectTrigger id="doc-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Upload area */}
        {!file && (
          <Card
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed p-12 text-center cursor-pointer transition-all ring-0',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5'
            )}
          >
            <input {...getInputProps()} />
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {isDragActive ? 'Drop screenshot here...' : 'Drag & drop a DAT screenshot'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse &middot; PNG, JPG, WebP</p>
          </Card>
        )}

        {/* Preview + Extract */}
        {file && !done && (
          <div className="space-y-4">
            <Card className="p-0">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
              </div>
              {preview && (
                <div className="p-4 flex justify-center bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Screenshot preview" className="max-h-80 rounded-lg shadow-sm" />
                </div>
              )}
            </Card>

            <Button
              onClick={handleExtract}
              disabled={parsing}
              size="lg"
              className="w-full py-4 h-auto text-base font-bold"
            >
              {parsing ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Gemini is extracting load data...</>
              ) : (
                <><Zap className="h-5 w-5" /> Extract Loads with Vision AI</>
              )}
            </Button>
          </div>
        )}

        {/* Results */}
        {done && (
          <div className="space-y-4">
            <Card className="border-success/30 bg-success/10">
              <CardContent className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-success shrink-0" />
                <div>
                  <p className="font-bold text-success">
                    {createdCount} load{createdCount !== 1 ? 's' : ''} extracted and added to HUCK
                  </p>
                  <p className="text-xs text-success/80 mt-0.5">Vision AI parsed your screenshot and created load entries</p>
                </div>
              </CardContent>
            </Card>

            {parsedLoads.length > 0 && (
              <Card className="p-0">
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Extracted Loads</p>
                </div>
                <div className="divide-y divide-border">
                  {parsedLoads.map((load, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">
                          {load.origin_city}, {load.origin_state}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-bold text-foreground">
                          {load.dest_city}, {load.dest_state}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {load.equipment_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{load.miles} mi</span>
                        <span className="font-black text-foreground">${Number(load.posted_rate).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Parsed JSON */}
            <Card className="p-0">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Extracted Data</p>
              </div>
              <div className="p-4">
                <pre className="text-xs text-foreground overflow-auto max-h-96 bg-muted rounded-lg p-4">
                  {JSON.stringify(parsedLoads, null, 2)}
                </pre>
              </div>
            </Card>

            {preview && (
              <Card className="p-0">
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Source Screenshot</p>
                </div>
                <div className="p-4 flex justify-center bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Source" className="max-h-60 rounded-lg shadow-sm opacity-75" />
                </div>
              </Card>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button onClick={handleReset} variant="outline" size="lg" className="flex-1 py-3 h-auto font-semibold">
                Upload Another
              </Button>
              <Link
                href="/"
                className={buttonVariants({
                  size: 'lg',
                  className: 'flex-1 py-3 h-auto font-semibold',
                })}
              >
                Back to HUCK Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
