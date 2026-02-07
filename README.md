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

## Demo 页面

在仓库根目录启动静态服务后访问：

- http://localhost:8000/demo/index.html
- http://localhost:8000/demo/encode.html

步骤：
1. 若 `dist/` 不存在或需要更新构建产物，先执行 `yarn build:all`
2. 启动静态服务：`yarn dev`（基于 http-server）
3. 打开上述地址，点击 “Parse current page” 按钮查看 JSON 输出

说明：demo 仅面向浏览器环境，不影响库发布产物。

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
