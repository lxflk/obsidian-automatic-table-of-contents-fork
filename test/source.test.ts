import type { HeadingCache } from 'obsidian'
import { describe, expect, test } from 'vitest'
import { filterHeadingsInDisplayMath } from '../src/source.js'

describe('filterHeadingsInDisplayMath', () => {
  test('Removes headings reported from multiline LaTeX blocks', () => {
    const sourceText = [
      '# General Concepts',
      '',
      '```table-of-contents',
      '```',
      '',
      '## Deep learning',
      '### Vision Transformers',
      '### Scaled dot-product attention',
      '',
      '- At each iteration:',
      '\t1. compute image forces from the gradient image',
      '\t2. solve a linear system such as $$',
      '(K+\\alpha I)X_t',
      '=',
      '\\alpha X_{t-1}',
      '-',
      '\\frac{\\partial E_G}{\\partial X}',
      '$$',
      '',
      '\t3. update the curve',
      '- $K+\\alpha I$ is invertible, so the iterative system can be solved.',
      '',
      '## Computer Vision Tasks',
    ].join('\n')
    const headings = [
      toHeading('General Concepts', 1, 0),
      toHeading('Deep learning', 2, 5),
      toHeading('Vision Transformers', 3, 6),
      toHeading('Scaled dot-product attention', 3, 7),
      toHeading('(K+\\alpha I)X_t', 1, 12, 13),
      toHeading('\\alpha X_{t-1}', 2, 14, 15),
      toHeading('Computer Vision Tasks', 2, 22),
    ]

    const filteredHeadings = filterHeadingsInDisplayMath(headings, sourceText)

    expect(filteredHeadings.map((heading) => heading.heading)).toEqual([
      'General Concepts',
      'Deep learning',
      'Vision Transformers',
      'Scaled dot-product attention',
      'Computer Vision Tasks',
    ])
  })

  test('Keeps headings with same-line math delimiters', () => {
    const sourceText = '# Energy $$E = mc^2$$\n\n## Details'
    const headings = [toHeading('Energy $$E = mc^2$$', 1, 0), toHeading('Details', 2, 2)]

    const filteredHeadings = filterHeadingsInDisplayMath(headings, sourceText)

    expect(filteredHeadings).toEqual(headings)
  })

  test('Ignores math delimiters inside fenced code blocks', () => {
    const sourceText = ['# Start', '```', '$$', 'not a heading', '=', '$$', '```', '## After'].join(
      '\n',
    )
    const headings = [toHeading('Start', 1, 0), toHeading('After', 2, 7)]

    const filteredHeadings = filterHeadingsInDisplayMath(headings, sourceText)

    expect(filteredHeadings).toEqual(headings)
  })
})

function toHeading(
  heading: string,
  level: number,
  startLine: number,
  endLine = startLine,
): HeadingCache {
  return {
    heading,
    level,
    position: {
      start: { line: startLine, col: 0, offset: 0 },
      end: { line: endLine, col: heading.length, offset: heading.length },
    },
  }
}
