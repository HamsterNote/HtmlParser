import { CoverageReport, MockDataConfig, MockDataset } from '../types'

type Store<T> = {
  set: (id: string, value: T) => void
  get: (id: string) => T | undefined
  list: () => T[]
}

const createStore = <T>(): Store<T> => {
  const map = new Map<string, T>()
  return {
    set: (id, value) => {
      map.set(id, value)
    },
    get: (id) => map.get(id),
    list: () => Array.from(map.values())
  }
}

export const mockConfigStore = createStore<MockDataConfig>()
export const mockDatasetStore = createStore<MockDataset>()
export const coverageReportStore = createStore<CoverageReport>()

let idCounter = 0
export const createMockId = (prefix: string): string => {
  const now = Date.now()
  idCounter += 1
  return `${prefix}-${now}-${idCounter}`
}
