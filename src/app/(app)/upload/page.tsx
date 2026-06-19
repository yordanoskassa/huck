'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DOC_TYPES: Record<string, string> = {
  dat_screenshot: 'DAT Screenshot',
  bol: 'Bill of Lading',
  rate_confirmation: 'Rate Confirmation',
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState('dat_screenshot')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    parsed_data: unknown
    created_loads: unknown[]
  } | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setResult(null)
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
        toast.error(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-6">Upload &amp; Parse</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload area */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Document Type</Label>
            <Select
              items={DOC_TYPES}
              value={uploadType}
              onValueChange={(value) => value && setUploadType(value)}
            >
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

          <Card
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed p-12 text-center cursor-pointer transition-colors ring-0',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50 bg-card'
            )}
          >
            <input {...getInputProps()} />
            <FileImage className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            {isDragActive ? (
              <p className="text-sm text-primary">Drop the image here</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Drag &amp; drop an image, or click to browse</p>
                <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG, WebP</p>
              </>
            )}
          </Card>

          {preview && (
            <Card>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="rounded-lg w-full max-h-64 object-contain" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground truncate">{file?.name}</p>
                  <Button onClick={handleUpload} disabled={loading} size="lg">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {loading ? 'Parsing with AI...' : 'Upload & Parse'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results */}
        <div>
          {result && (
            <div className="space-y-4">
              {result.created_loads && (result.created_loads as unknown[]).length > 0 && (
                <Card>
                  <CardContent className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {(result.created_loads as unknown[]).length} load(s) created
                    </span>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Extracted Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-foreground overflow-auto max-h-96 bg-muted rounded-lg p-4">
                    {JSON.stringify(result.parsed_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
