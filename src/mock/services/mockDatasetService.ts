import { MockDataConfig, MockDataset, GenerateDatasetRequest, ConflictDiagnostic } from '../types'
import { MockError } from '../errors'
import { mockDatasetStore } from '../store/mockStores'
import { buildDataset } from '../generation/datasetBuilder'
import { getMockConfig } from './mockConfigService'
import { validateConfig } from '../validators/configValidator'

export type DatasetGenerationResult = {
  dataset?: MockDataset
  conflict?: ConflictDiagnostic
}

const ensureConfig = (configId: string): MockDataConfig => getMockConfig(configId)

export const generateMockDataset = (
  request: GenerateDatasetRequest
): DatasetGenerationResult => {
  if (!request.configId.trim()) {
    throw new MockError('CONFIG_INVALID', 'configId is required')
  }

  const config = ensureConfig(request.configId)
  const validation = validateConfig(config)

  if (!validation.valid && validation.conflict) {
    return { conflict: validation.conflict }
  }

  const dataset = buildDataset(config, request.overrideSeed)
  mockDatasetStore.set(dataset.id, dataset)
  return { dataset }
}
