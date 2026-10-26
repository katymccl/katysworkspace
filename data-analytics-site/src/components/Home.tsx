import { ArrowRight, Database } from 'lucide-react'
import semaMark from '../assets/sema-mark.png'
import { Wordmark } from './Wordmark'

interface HomeProps {
  datasetCount: number
  onUpload: () => void
  onViewDatasets: () => void
}

/** Follows the brand's "primary logo (large)" lockup: wordmark and tagline left, mark right. */
export function Home({ datasetCount, onUpload, onViewDatasets }: HomeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="flex flex-col-reverse items-center gap-10 md:flex-row md:gap-16">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <h1>
            <Wordmark className="text-7xl leading-none sm:text-8xl lg:text-9xl" />
          </h1>
          <p className="mt-3 font-display text-xl tracking-wide text-slate-500 sm:text-2xl lg:text-3xl">
            Give your data meaning.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3 md:justify-start">
            <button
              onClick={onUpload}
              className="flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Upload a dataset <ArrowRight className="h-4 w-4" />
            </button>
            {datasetCount > 0 && (
              <button
                onClick={onViewDatasets}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <Database className="h-4 w-4" />
                View {datasetCount} dataset{datasetCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        <img src={semaMark} alt="" className="w-48 sm:w-64 lg:w-80" />
      </div>
    </div>
  )
}
