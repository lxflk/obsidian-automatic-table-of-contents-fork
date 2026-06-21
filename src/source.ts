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

export function getHeadingsFromSource(sourceText: string): HeadingCache[] {
  const lines = sourceText.split(/\r?\n/)
  const headings: HeadingCache[] = []
  let activeFence: Fence | null = null
  let isInDisplayMath = false
  let isInFrontmatter = lines[0]?.trim() === '---'
  let previousSetextCandidate: { line: string; lineIndex: number } | null = null

  lines.forEach((line, lineIndex) => {
    if (isInFrontmatter) {
      if (lineIndex > 0 && line.trim() === '---') {
        isInFrontmatter = false
      }
      previousSetextCandidate = null
      return
    }

    if (!isInDisplayMath) {
      const fence = getFence(line)
      if (fence !== null) {
        if (activeFence === null) {
          activeFence = fence
        } else if (fence.char === activeFence.char && fence.length >= activeFence.length) {
          activeFence = null
        }
        previousSetextCandidate = null
        return
      }
    }

    if (activeFence !== null) {
      previousSetextCandidate = null
      return
    }

    const wasInDisplayMath = isInDisplayMath

    if (!wasInDisplayMath) {
      const setextLevel = getSetextHeadingLevel(line)
      if (setextLevel !== null && previousSetextCandidate !== null) {
        headings.push(
          toHeadingCache(
            previousSetextCandidate.line,
            setextLevel,
            previousSetextCandidate.lineIndex,
          ),
        )
        previousSetextCandidate = null
      } else {
        const atxHeading = getAtxHeading(line)
        if (atxHeading !== null) {
          headings.push(toHeadingCache(atxHeading.heading, atxHeading.level, lineIndex))
          previousSetextCandidate = null
        } else if (isSetextCandidate(line)) {
          previousSetextCandidate = { line: line.trim(), lineIndex }
        } else {
          previousSetextCandidate = null
        }
      }
    } else {
      previousSetextCandidate = null
    }

    isInDisplayMath = toggleDisplayMath(line, isInDisplayMath)
  })

  return headings
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

function getAtxHeading(line: string): { heading: string; level: number } | null {
  const match = /^(?: {0,3})(#{1,6})(?:[\t ]+|$)(.*)$/.exec(line)
  if (!match?.[1]) return null

  const rawHeading = match[2] ?? ''
  const heading = rawHeading.replace(/[\t ]+#+[\t ]*$/, '').trim()
  return {
    heading,
    level: match[1].length,
  }
}

function getSetextHeadingLevel(line: string): number | null {
  const match = /^(?: {0,3})(=+|-+)[\t ]*$/.exec(line)
  const marker = match?.[1]?.[0]
  if (marker === '=') return 1
  if (marker === '-') return 2
  return null
}

function isSetextCandidate(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (/^#{1,6}(?:[\t ]+|$)/.test(trimmed)) return false
  if (/^(?:[-+*]|\d+\.)[\t ]+/.test(trimmed)) return false
  return true
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

function toggleDisplayMath(line: string, isInDisplayMath: boolean): boolean {
  let nextIsInDisplayMath = isInDisplayMath
  const delimiterCount = getDisplayMathDelimiterColumns(line).length

  for (let delimiterIndex = 0; delimiterIndex < delimiterCount; delimiterIndex += 1) {
    nextIsInDisplayMath = !nextIsInDisplayMath
  }

  return nextIsInDisplayMath
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

function toHeadingCache(heading: string, level: number, line: number): HeadingCache {
  return {
    heading,
    level,
    position: {
      start: { line, col: 0, offset: 0 },
      end: { line, col: heading.length, offset: heading.length },
    },
  }
}
