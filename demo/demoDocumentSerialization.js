const ensureRecord = (value, label) => {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} is missing or invalid.`)
  }
  return value
}

const requireString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

const requireNumber = (value, label) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number.`)
  }
  return value
}

const parseSerializedText = (data) => {
  const record = ensureRecord(data, 'Text')
  return {
    id: requireString(record.id, 'Text.id'),
    content: requireString(record.content, 'Text.content'),
    fontSize: requireNumber(record.fontSize, 'Text.fontSize'),
    fontFamily: typeof record.fontFamily === 'string' ? record.fontFamily : '',
    fontWeight: typeof record.fontWeight === 'number' ? record.fontWeight : 400,
    italic: Boolean(record.italic),
    color: typeof record.color === 'string' ? record.color : '',
    width: requireNumber(record.width, 'Text.width'),
    height: requireNumber(record.height, 'Text.height'),
    lineHeight: requireNumber(record.lineHeight, 'Text.lineHeight'),
    x: requireNumber(record.x, 'Text.x'),
    y: requireNumber(record.y, 'Text.y'),
    ascent: typeof record.ascent === 'number' ? record.ascent : 0,
    descent: typeof record.descent === 'number' ? record.descent : 0,
    vertical: Boolean(record.vertical),
    dir: typeof record.dir === 'string' ? record.dir : 'ltr',
    rotate: typeof record.rotate === 'number' ? record.rotate : 0,
    skew: typeof record.skew === 'number' ? record.skew : 0,
    isEOL: Boolean(record.isEOL)
  }
}

const parseSerializedOutline = (data) => {
  const record = ensureRecord(data, 'Outline')
  return {
    ...parseSerializedText(record),
    dest: record.dest
  }
}

const parseSerializedPage = (data) => {
  const record = ensureRecord(data, 'Page')
  if (!Array.isArray(record.texts)) {
    throw new Error('Page.texts must be an array.')
  }
  const thumbnail =
    typeof record.thumbnail === 'string' ? record.thumbnail : undefined
  return {
    id: requireString(record.id, 'Page.id'),
    number: requireNumber(record.number, 'Page.number'),
    width: requireNumber(record.width, 'Page.width'),
    height: requireNumber(record.height, 'Page.height'),
    texts: record.texts.map(parseSerializedText),
    getThumbnail: async () => thumbnail
  }
}

export const parseSerializedDocument = (data) => {
  const record = ensureRecord(data, 'Document')
  if (!Array.isArray(record.pages)) {
    throw new Error('Document.pages must be an array.')
  }

  const pages = record.pages.map(parseSerializedPage)
  const outline = Array.isArray(record.outline)
    ? record.outline.map(parseSerializedOutline)
    : undefined

  return {
    id: typeof record.id === 'string' ? record.id : 'demo-document',
    title: typeof record.title === 'string' ? record.title : 'Demo Document',
    outline,
    pages: Promise.resolve(pages)
  }
}

const serializeText = (text) => ({ ...text })
const serializeOutline = (outline) => ({ ...outline })

const serializePage = async (page) => {
  const texts = await page.getTexts()
  return {
    id: page.id,
    number: page.number,
    width: page.width,
    height: page.height,
    thumbnail: await page.getThumbnail(0.3),
    texts: texts.map(serializeText)
  }
}

export const serializeIntermediate = async (intermediate) => {
  const pages = await intermediate.pages
  const rawOutline =
    typeof intermediate.getOutline === 'function'
      ? intermediate.getOutline()
      : intermediate.outline
  const outline = Array.isArray(rawOutline)
    ? rawOutline.map(serializeOutline)
    : undefined
  const serializedPages = await Promise.all(pages.map(serializePage))

  return {
    id: intermediate.id,
    title: intermediate.title,
    outline,
    pages: serializedPages
  }
}
