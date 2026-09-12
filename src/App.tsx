import axios from 'axios'
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  DollarSign,
  Database,
  History,
  LoaderCircle,
  MessageSquareText,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

type Severity = 'critical' | 'warning' | 'info'

type Issue = {
  ruleId: string
  severity: Severity
  title: string
  detail: string
  evidence: Record<string, unknown>
}

type ToolCall = {
  tool: string
  arguments: unknown
  durationMs: number
  cached: boolean
  ok: boolean
  result: { ok: boolean; data?: unknown; reason?: string; message?: string }
}

type QueryResponse = {
  queryId: string
  answer: string
  issues: Issue[]
  toolCalls: ToolCall[]
  meta: {
    iterations: number
    degraded: boolean
    provider: string
    model: string
    usage?: {
      attempts: number
      inputTokens: number
      outputTokens: number
      cacheReadTokens?: number
      inputCostUsd: string | null
      outputCostUsd: string | null
      cacheReadCostUsd: string | null
      totalCostUsd: string | null
    }
  }
}

type HistoryItem = {
  queryId: string
  query: string
  answer: string
  issueCount: number
  toolCallCount: number
  meta: QueryResponse['meta']
  createdAt: string
}

type CostItem = {
  queryId: string
  query: string | null
  provider: string
  model: string
  attempts: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalCostUsd: string | null
  createdAt: string
}

type CostReport = {
  totalQueries: number
  totalAttempts: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalCostUsd: string | null
  hasUnpricedQueries: boolean
  queries: CostItem[]
}

type View = 'ask' | 'history' | 'costs'

const EXAMPLE_QUERIES = [
  'Which orders have critical issues right now?',
  'Why is order #4521 delayed?',
  'Show paid orders that are not scheduled for delivery',
]

const severityIcon = {
  critical: CircleAlert,
  warning: AlertTriangle,
  info: ShieldCheck,
}

function formatToolName(tool: string) {
  return tool.replaceAll('_', ' ')
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string } | undefined
    if (payload?.message) return payload.message
    if (!error.response) {
      return 'Cannot reach the operations API. Make sure the backend is running on port 5000.'
    }
  }
  return 'The query could not be completed. Please try again.'
}

function App() {
  const [view, setView] = useState<View>('ask')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [costReport, setCostReport] = useState<CostReport | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    axios
      .get('/health', { signal: controller.signal })
      .then(() => setApiOnline(true))
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) setApiOnline(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (view === 'ask') return
    const controller = new AbortController()
    const request = view === 'history'
      ? axios.get<{ queries: HistoryItem[] }>('/api/queries', { signal: controller.signal })
      : axios.get<CostReport>('/api/costs', { signal: controller.signal })

    request
      .then((response) => {
        if (view === 'history') setHistory((response.data as { queries: HistoryItem[] }).queries)
        else setCostReport(response.data as CostReport)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) setPageError(getErrorMessage(requestError))
      })
      .finally(() => setPageLoading(false))

    return () => controller.abort()
  }, [view])

  async function submitQuery(event?: FormEvent) {
    event?.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery || isLoading) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await axios.post<QueryResponse>('/api/query', { query: trimmedQuery })
      setResult(response.data)
      setApiOnline(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  function resetConversation() {
    setView('ask')
    setQuery('')
    setResult(null)
    setError(null)
  }

  function openView(nextView: Exclude<View, 'ask'>) {
    setPageLoading(true)
    setPageError(null)
    setView(nextView)
  }

  async function openHistoryItem(item: HistoryItem) {
    setPageLoading(true)
    setPageError(null)
    try {
      const response = await axios.get<QueryResponse & { query: string }>(`/api/queries/${item.queryId}`)
      setQuery(response.data.query)
      setResult(response.data)
      setView('ask')
    } catch (requestError) {
      setPageError(getErrorMessage(requestError))
    } finally {
      setPageLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="CARS24 Ops Copilot home">
          <span className="brand-mark">CARS24</span>
          <span className="brand-divider" />
          <span className="brand-product">Ops Copilot</span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <button className={view === 'ask' ? 'active' : ''} type="button" onClick={() => setView('ask')}>
            <MessageSquareText size={15} />Ask
          </button>
          <button className={view === 'history' ? 'active' : ''} type="button" onClick={() => openView('history')}>
            <History size={15} />History
          </button>
          <button className={view === 'costs' ? 'active' : ''} type="button" onClick={() => openView('costs')}>
            <DollarSign size={15} />Costs
          </button>
        </nav>
        <div className="topbar-actions">
          <div className={`api-status ${apiOnline === false ? 'offline' : ''}`}>
            <span className="status-dot" />
            {apiOnline === null ? 'Checking API' : apiOnline ? 'Systems operational' : 'API offline'}
          </div>
          <button className="icon-button" type="button" aria-label="Start a new query" title="New query" onClick={resetConversation}>
            <RotateCcw size={17} />
          </button>
          <div className="avatar" aria-label="Operations user">OP</div>
        </div>
      </header>

      {view === 'ask' && <main className="workspace">
        <section className="query-panel" aria-labelledby="page-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow"><Sparkles size={14} /> AI operations assistant</p>
              <h1 id="page-title">What needs attention?</h1>
              <p className="intro">Ask about orders, payments, and deliveries. Every answer is checked against live operational data.</p>
            </div>
          </div>

          <form className="query-form" onSubmit={submitQuery}>
            <label htmlFor="ops-query">Ask Ops Copilot</label>
            <div className={`query-box ${isLoading ? 'is-loading' : ''}`}>
              <Search size={20} aria-hidden="true" />
              <textarea
                id="ops-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitQuery()
                  }
                }}
                placeholder="Ask about an order or find operational issues..."
                rows={2}
                maxLength={2000}
                disabled={isLoading}
              />
              <button className="submit-button" type="submit" disabled={!query.trim() || isLoading} aria-label="Submit query" title="Submit query">
                {isLoading ? <LoaderCircle className="spin" size={19} /> : <ArrowUp size={19} />}
              </button>
            </div>
            <div className="query-footer"><span>Press Enter to send</span><span>{query.length}/2000</span></div>
          </form>

          {!result && !isLoading && (
            <div className="examples" aria-label="Example questions">
              <p>Try a demo query</p>
              <div className="example-list">
                {EXAMPLE_QUERIES.map((example) => (
                  <button key={example} type="button" onClick={() => { setQuery(example); setError(null) }}>
                    <span>{example}</span><ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="loading-state" role="status">
              <div className="thinking-mark"><Bot size={22} /></div>
              <div><strong>Investigating your request</strong><span>Choosing tools and checking operational records...</span></div>
              <div className="loading-bars"><i /><i /><i /></div>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <CircleAlert size={19} />
              <div><strong>Unable to complete query</strong><span>{error}</span></div>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={17} /></button>
            </div>
          )}

          {result && !isLoading && <Results result={result} />}
        </section>

        <aside className="trust-rail" aria-label="System trust information">
          <div className="rail-section">
            <p className="rail-label">How it works</p>
            <TrustStep icon={<Bot size={17} />} title="Understands intent" copy="Selects only approved tools" />
            <TrustStep icon={<Database size={17} />} title="Queries live data" copy="No direct model database access" />
            <TrustStep icon={<ShieldCheck size={17} />} title="Checks consistency" copy="Deterministic business rules" />
          </div>
          {/* <div className="rail-note"><Zap size={17} /><p><strong>Auditable by design</strong>Every finding links back to a tool result and its evidence.</p></div> */}
        </aside>
      </main>}

      {view === 'history' && (
        <HistoryView
          history={history}
          loading={pageLoading}
          error={pageError}
          onOpen={(item) => void openHistoryItem(item)}
          onStartNew={resetConversation}
        />
      )}

      {view === 'costs' && (
        <CostsView report={costReport} loading={pageLoading} error={pageError} />
      )}
    </div>
  )
}

function PageState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <div className="page-state"><LoaderCircle className="spin" size={22} />Loading records...</div>
  if (error) return <div className="page-state error"><CircleAlert size={20} />{error}</div>
  return null
}

function HistoryView({
  history,
  loading,
  error,
  onOpen,
  onStartNew,
}: {
  history: HistoryItem[]
  loading: boolean
  error: string | null
  onOpen: (item: HistoryItem) => void
  onStartNew: () => void
}) {
  return (
    <main className="data-page">
      <div className="data-page-heading">
        <div><p className="eyebrow"><History size={14} />Saved conversations</p><h1>Query history</h1><p className="intro">Reopen previous investigations with their answers, findings, and audit trails intact.</p></div>
        <button className="primary-action" type="button" onClick={onStartNew}><MessageSquareText size={16} />New query</button>
      </div>
      <PageState loading={loading} error={error} />
      {!loading && !error && history.length === 0 && (
        <div className="empty-state"><History size={25} /><strong>No saved queries yet</strong><span>Completed queries will appear here.</span></div>
      )}
      {!loading && !error && history.length > 0 && (
        <div className="history-list">
          {history.map((item) => (
            <button className="history-row" type="button" key={item.queryId} onClick={() => onOpen(item)}>
              <div className="history-icon"><MessageSquareText size={17} /></div>
              <div className="history-copy"><strong>{item.query}</strong><p>{item.answer}</p></div>
              <div className="history-facts"><span>{formatDate(item.createdAt)}</span><span>{item.toolCallCount} tools · {item.issueCount} issues</span></div>
              <ArrowUp size={16} />
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function CostsView({ report, loading, error }: { report: CostReport | null; loading: boolean; error: string | null }) {
  return (
    <main className="data-page">
      <div className="data-page-heading"><div><p className="eyebrow"><ReceiptText size={14} />Model usage</p><h1>Query costs</h1><p className="intro">Token usage and estimated model spend across every recorded attempt.</p></div></div>
      <PageState loading={loading} error={error} />
      {!loading && !error && report && (
        <>
          <div className="cost-metrics">
            <Metric label="Estimated spend" value={formatUsd(report.totalCostUsd)} detail={report.hasUnpricedQueries ? 'Some queries are unpriced' : 'All recorded queries'} />
            <Metric label="Queries" value={report.totalQueries.toLocaleString()} detail={`${report.totalAttempts.toLocaleString()} model attempts`} />
            <Metric label="Input tokens" value={report.inputTokens.toLocaleString()} detail={`${report.cacheReadTokens.toLocaleString()} cache-read tokens`} />
            <Metric label="Output tokens" value={report.outputTokens.toLocaleString()} detail="Generated responses" />
          </div>
          <section className="cost-table-section">
            <div className="section-title-row"><div><p className="section-kicker">Breakdown</p><h2>Cost by query</h2></div></div>
            {report.queries.length === 0 ? (
              <div className="empty-state"><ReceiptText size={25} /><strong>No usage recorded</strong><span>Model costs will appear after your first query.</span></div>
            ) : (
              <div className="cost-table-wrap"><table className="cost-table"><thead><tr><th>Query</th><th>Model</th><th>Tokens</th><th>Attempts</th><th>Estimated cost</th></tr></thead><tbody>
                {report.queries.map((item) => <tr key={item.queryId}><td><strong>{item.query ?? 'Legacy query'}</strong><span>{formatDate(item.createdAt)}</span></td><td>{item.model}</td><td>{(item.inputTokens + item.outputTokens).toLocaleString()}</td><td>{item.attempts}</td><td>{formatUsd(item.totalCostUsd)}</td></tr>)}
              </tbody></table></div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><p>{detail}</p></div>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatUsd(value: string | null) {
  if (value === null) return 'Pricing unavailable'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(Number(value))
}

function TrustStep({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="trust-step"><span>{icon}</span><div><strong>{title}</strong><p>{copy}</p></div></div>
}

function Results({ result }: { result: QueryResponse }) {
  const [traceOpen, setTraceOpen] = useState(false)
  const totalDuration = result.toolCalls.reduce((sum, call) => sum + call.durationMs, 0)

  return (
    <div className="results" aria-live="polite">
      <div className="result-meta">
        <span className={result.meta.degraded ? 'degraded' : ''}>
          {result.meta.degraded ? <AlertTriangle size={14} /> : <Check size={14} />}
          {result.meta.degraded ? 'Partial answer' : 'Verified answer'}
        </span>
        <span><Clock3 size={14} />{totalDuration} ms tool time</span>
        <span>{result.toolCalls.length} tool{result.toolCalls.length === 1 ? '' : 's'} used</span>
      </div>

      <article className="answer-block">
        <div className="answer-icon"><Bot size={21} /></div>
        <div className="answer-content">
          <p className="answer-label">Ops Copilot</p>
          <div className="answer-copy">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
              }}
            >
              {result.answer}
            </ReactMarkdown>
          </div>
        </div>
      </article>

      {result.issues.length > 0 && (
        <section className="issues-section" aria-labelledby="issues-title">
          <div className="section-title-row">
            <div><p className="section-kicker">Reconciliation</p><h2 id="issues-title">Detected issues</h2></div>
            <span className="issue-count">{result.issues.length}</span>
          </div>
          <div className="issue-list">
            {result.issues.map((issue, index) => {
              const Icon = severityIcon[issue.severity]
              return (
                <article className={`issue-item ${issue.severity}`} key={`${issue.ruleId}-${index}`}>
                  <div className="issue-icon"><Icon size={18} /></div>
                  <div className="issue-body">
                    <div className="issue-heading"><h3>{issue.title}</h3><span>{issue.severity}</span></div>
                    <p>{issue.detail}</p>
                    <details><summary>View evidence</summary><pre>{JSON.stringify(issue.evidence, null, 2)}</pre></details>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="trace-section">
        <button className="trace-toggle" type="button" aria-expanded={traceOpen} onClick={() => setTraceOpen((open) => !open)}>
          <span><Wrench size={17} />Audit trail</span>
          <span className="trace-summary">{result.toolCalls.length} calls · {result.meta.provider}</span>
          <ChevronDown className={traceOpen ? 'rotated' : ''} size={18} />
        </button>
        {traceOpen && (
          <div className="trace-content">
            {result.toolCalls.map((call, index) => (
              <details className="tool-call" key={`${call.tool}-${index}`}>
                <summary>
                  <span className={`tool-state ${call.ok ? 'ok' : 'failed'}`}>{call.ok ? <Check size={13} /> : <X size={13} />}</span>
                  <code>{formatToolName(call.tool)}</code>
                  {call.cached && <span className="cache-tag">cached</span>}
                  <span className="tool-duration">{call.durationMs} ms</span>
                </summary>
                <div className="tool-data">
                  <div><span>Arguments</span><pre>{JSON.stringify(call.arguments, null, 2)}</pre></div>
                  <div><span>Result</span><pre>{JSON.stringify(call.result, null, 2)}</pre></div>
                </div>
              </details>
            ))}
            <div className="trace-id">Query ID <code>{result.queryId}</code></div>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
