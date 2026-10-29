import { useRef, useState, type DragEvent } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { formatBytes, isCsvFile, MAX_FILE_SIZE, parseCsv, type CsvData } from '../lib/parseCsv'

interface CsvUploaderProps {
  /** Called once per batch of files with the parsed files and one message per rejected file. */
  onUpload: (loaded: CsvData[], errors: string[]) => void
}

async function loadFile(file: File): Promise<CsvData> {
  if (!isCsvFile(file)) throw new Error(`"${file.name}" isn't a CSV file.`)
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_FILE_SIZE)}.`,
    )
  }
  try {
    return await parseCsv(file)
  } catch (e) {
    throw new Error(`"${file.name}": ${e instanceof Error ? e.message : 'could not be read.'}`)
  }
}

export function CsvUploader({ onUpload }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  async function handleFiles(files: FileList | null | undefined) {
    if (!files || files.length === 0) return
    setIsParsing(true)

    const results = await Promise.allSettled([...files].map(loadFile))
    setIsParsing(false)
    // Allow re-selecting the same files after an error.
    if (inputRef.current) inputRef.current.value = ''

    onUpload(
      results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
      results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as Error).message] : [])),
    )
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          isDragging
            ? 'border-violet-500 bg-violet-50'
            : 'border-slate-300 bg-white hover:border-violet-400 hover:bg-slate-50'
        }`}
      >
        {isParsing ? (
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
        ) : (
          <FileUp className="h-10 w-10 text-violet-500" />
        )}
        <div>
          <p className="font-medium">
            {isParsing ? 'Reading files…' : 'Drop CSV files here, or click to browse'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Select one or more files · first row is used as column headers · up to{' '}
            {formatBytes(MAX_FILE_SIZE)} each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
