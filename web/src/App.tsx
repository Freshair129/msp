import { useState, useEffect } from 'react'
import { api } from './api'
import type { Atom, GraphData } from './api'
import AtomList from './components/AtomList'
import CandidatesList from './components/CandidatesList'
import GraphView from './components/GraphView'
import AtomDetail from './components/AtomDetail'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import BrainSwitcher from './components/BrainSwitcher'
import SymbolsTab from './components/SymbolsTab'

type LeftTab = 'atoms' | 'candidates' | 'symbols'

/**
 * Symbols tab is gated for PR-5 of the Symbol Graph rollout. Visibility flips on
 * via either:
 *   - `VITE_MSP_SYMBOL_GRAPH=1` env var at build time
 *   - `?symbols=1` URL query param at runtime (for local poking)
 * PR-6 removes the flag once the graph build pipeline is wired into setup.
 */
function symbolsTabEnabled(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  if (env && env.VITE_MSP_SYMBOL_GRAPH === '1') return true
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('symbols') === '1') return true
  }
  return false
}

export default function App() {
  const [atoms, setAtoms] = useState<Atom[]>([])
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null)
  const [hotfixCount, setHotfixCount] = useState(0)
  const [candidatesCount, setCandidatesCount] = useState(0)
  const [leftTab, setLeftTab] = useState<LeftTab>('atoms')
  const [reloadKey, setReloadKey] = useState(0)
  const [showSymbols] = useState<boolean>(() => symbolsTabEnabled())

  useEffect(() => {
    Promise.all([
      api.getAtoms(),
      api.getGraph(),
      api.getHotfixes(),
      api.listCandidates()
    ]).then(([atomsRes, graphRes, hotfixRes, candidatesRes]) => {
      setAtoms(atomsRes)
      setGraphData(graphRes)
      setHotfixCount(hotfixRes.length)
      setCandidatesCount(candidatesRes.length)
    }).catch(console.error)
  }, [reloadKey])

  return (
    <>
      <div className="top-bar" style={{ justifyContent: 'space-between' }}>
        <BrainSwitcher onChanged={() => setReloadKey(k => k + 1)} />
        <SearchBar onSelectAtom={setSelectedAtomId} />
      </div>

      <div className="main-content">
        {leftTab === 'symbols' ? (
          <div style={{ flex: 1, display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
                <button
                  onClick={() => setLeftTab('atoms')}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Atoms ({atoms.length})
                </button>
                <button
                  onClick={() => setLeftTab('candidates')}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Candidates ({candidatesCount})
                </button>
                {showSymbols && (
                  <button
                    onClick={() => setLeftTab('symbols')}
                    style={{
                      flex: 1,
                      padding: 8,
                      border: 'none',
                      background: '#eef',
                      cursor: 'pointer',
                    }}
                    aria-label="symbols-tab-button"
                  >
                    Symbols
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <SymbolsTab />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="panel-left">
              <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
                <button
                  onClick={() => setLeftTab('atoms')}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: 'none',
                    background: leftTab === 'atoms' ? '#eef' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Atoms ({atoms.length})
                </button>
                <button
                  onClick={() => setLeftTab('candidates')}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: 'none',
                    background: leftTab === 'candidates' ? '#eef' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Candidates ({candidatesCount})
                </button>
                {showSymbols && (
                  <button
                    onClick={() => setLeftTab('symbols')}
                    style={{
                      flex: 1,
                      padding: 8,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    aria-label="symbols-tab-button"
                  >
                    Symbols
                  </button>
                )}
              </div>
              {leftTab === 'atoms' ? (
                <AtomList
                  atoms={atoms}
                  selectedId={selectedAtomId}
                  onSelect={setSelectedAtomId}
                />
              ) : (
                <CandidatesList onChanged={() => setReloadKey((k) => k + 1)} />
              )}
            </div>

            <div className="panel-center">
              <GraphView
                data={graphData}
                selectedId={selectedAtomId}
                onSelect={setSelectedAtomId}
              />
            </div>

            <div className="panel-right">
              <AtomDetail atomId={selectedAtomId} />
            </div>
          </>
        )}
      </div>

      <StatusBar
        totalAtoms={atoms.length}
        hotfixCount={hotfixCount}
        candidatesCount={candidatesCount}
      />
    </>
  )
}
