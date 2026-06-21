import type { HeadingCache } from 'obsidian'

interface LineRange {
  start: number
  end: number
}

interface Fence {
  char: '`' | '~'
  length: number
}

export function filterHeadingsInDisplayMath(
  headings: HeadingCache[],
  sourceText: string | null,
): HeadingCache[] {
  if (sourceText === null || headings.length === 0) return headings

  const mathRanges = getDisplayMathLineRanges(sourceText)
  if (mathRanges.length === 0) return headings

  return headings.filter((heading) => {
    return !mathRanges.some((range) => rangesOverlap(heading.position, range))
  })
}

function getDisplayMathLineRanges(sourceText: string): LineRange[] {
  const lines = sourceText.split(/\r?\n/)
  const ranges: LineRange[] = []
  let activeFence: Fence | null = null
  let mathStartLine: number | null = null

  lines.forEach((line, lineIndex) => {
    if (mathStartLine === null) {
      const fence = getFence(line)
      if (fence !== null) {
        if (activeFence === null) {
          activeFence = fence
        } else if (fence.char === activeFence.char && fence.length >= activeFence.length) {
          activeFence = null
        }
        return
      }
    }

    if (activeFence !== null) return

    const delimiterCount = getDisplayMathDelimiterColumns(line).length
    for (let delimiterIndex = 0; delimiterIndex < delimiterCount; delimiterIndex += 1) {
      if (mathStartLine === null) {
        mathStartLine = lineIndex
        continue
      }

      if (lineIndex > mathStartLine) {
        ranges.push({ start: mathStartLine + 1, end: lineIndex })
      }
      mathStartLine = null
    }
  })

  if (mathStartLine !== null && mathStartLine < lines.length - 1) {
    ranges.push({ start: mathStartLine + 1, end: lines.length - 1 })
  }

  return ranges
}

function getFence(line: string): Fence | null {
  const match = /^(?: {0,3})(`{3,}|~{3,})/.exec(line)
  const marker = match?.[1]
  if (!marker) return null

  return {
    char: marker.startsWith('`') ? '`' : '~',
    length: marker.length,
  }
}

function getDisplayMathDelimiterColumns(line: string): number[] {
  const columns: number[] = []

  for (let index = 0; index < line.length - 1; index += 1) {
    if (line[index] === '$' && line[index + 1] === '$' && !isEscaped(line, index)) {
      columns.push(index)
      index += 1
    }
  }

  return columns
}

function isEscaped(line: string, index: number): boolean {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function rangesOverlap(headingPosition: HeadingCache['position'], range: LineRange): boolean {
  return headingPosition.start.line <= range.end && headingPosition.end.line >= range.start
}
