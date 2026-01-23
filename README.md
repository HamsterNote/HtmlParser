# @hamster-note/html-parser

## 简介

提供 HTML 解析与 mock 数据驱动的单测用例生成能力。

## HtmlParser 用法

```ts
import { HtmlParser } from '@hamster-note/html-parser'

const buffer = new TextEncoder().encode('<h1>Hello</h1>').buffer
const doc = await HtmlParser.encode(buffer)
const intermediate = doc.getIntermediateDocument()
```

## Mock 模块用法

```ts
import {
  createMockConfig,
  generateMockDataset,
  validateMockConfig
} from '@hamster-note/html-parser'

const config = createMockConfig({
  name: 'user-flow',
  version: 'v1',
  seed: 'user-flow-v1',
  targetModule: 'html-parser',
  fields: [
    {
      fieldName: 'title',
      type: 'string',
      required: true,
      nullable: false,
      length: { min: 1, max: 120 },
      boundaryValues: ['', 'A'],
      exceptionValues: [null]
    }
  ],
  generationParams: {
    sampleCount: 200,
    includeBoundarySamples: true,
    includeExceptionSamples: true,
    maxDurationSeconds: 600,
    configVersioning: true
  },
  sensitiveFieldPolicy: 'reject'
})

const validation = validateMockConfig(config.id)
const dataset = generateMockDataset({ configId: config.id }).dataset
```
