import type { HeadingCache } from 'obsidian'
import { describe, expect, test } from 'vitest'
import { getMarkdownFromHeadings } from '../src/headings.js'
import { parseOptionsFromSourceText } from '../src/options.js'
import { filterHeadingsInDisplayMath, getHeadingsFromSource } from '../src/source.js'

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

describe('getHeadingsFromSource', () => {
  test('Keeps headings after multiline LaTeX blocks', () => {
    const sourceText = [
      '```table-of-contents',
      '```',
      '# Deep learning',
      '## Vision Transformers',
      '## Scaled dot-product attention',
      '- The similarity-score matrix has shape: $QK^T \\in \\mathbb{R}^{4\\times 4}$ $$',
      'QK^{\\top} =',
      '\\begin{bmatrix}',
      '1.2 & 0.3 \\\\',
      '0.4 & 2.1',
      '\\end{bmatrix}',
      '$$',
      '- Lets assume a numeric example now:$$',
      'QK^{\\top} =',
      '\\begin{bmatrix}',
      '1.2 & 0.3 \\\\',
      '0.4 & 2.1',
      '\\end{bmatrix}',
      '$$',
      '## Dropout',
      '## U-net',
      '# Computer Vision Tasks',
      '## Edge detection',
      '# Delineation',
      '## Hough transform',
      '- A line is represented in polar form by: $$',
      'x\\cos(\\theta)+y\\sin(\\theta)=r',
      '$$',
      '## Minimum Spanning Tree',
      '- At each iteration:',
      '\t1. compute image forces from the gradient image',
      '\t2. solve a linear system such as $$',
      '(K+\\alpha I)X_t',
      '=',
      '\\alpha X_{t-1}',
      '-',
      '\\frac{\\partial E_G}{\\partial X}',
      '$$',
      '\t3. update the curve',
      '## Live Wire',
    ].join('\n')

    const headings = getHeadingsFromSource(sourceText)

    expect(headings.map((heading) => heading.heading)).toEqual([
      'Deep learning',
      'Vision Transformers',
      'Scaled dot-product attention',
      'Dropout',
      'U-net',
      'Computer Vision Tasks',
      'Edge detection',
      'Delineation',
      'Hough transform',
      'Minimum Spanning Tree',
      'Live Wire',
    ])
  })

  test('Generates a full table of contents from source headings', () => {
    const sourceText = [
      '# Deep learning',
      '## Scaled dot-product attention',
      '$$',
      '(K+\\alpha I)X_t',
      '=',
      '\\alpha X_{t-1}',
      '$$',
      '## Dropout',
      '# Computer Vision Tasks',
      '## Edge detection',
    ].join('\n')
    const options = parseOptionsFromSourceText('')

    const markdown = getMarkdownFromHeadings(getHeadingsFromSource(sourceText), options)

    expect(markdown).toContain('[[#Deep learning|Deep learning]]')
    expect(markdown).toContain('[[#Scaled dot-product attention|Scaled dot-product attention]]')
    expect(markdown).toContain('[[#Dropout|Dropout]]')
    expect(markdown).toContain('[[#Computer Vision Tasks|Computer Vision Tasks]]')
    expect(markdown).toContain('[[#Edge detection|Edge detection]]')
    expect(markdown).not.toContain('(K+\\alpha I)X_t')
    expect(markdown).not.toContain('\\alpha X_{t-1}')
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
