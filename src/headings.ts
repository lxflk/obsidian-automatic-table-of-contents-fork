import type { HeadingCache } from 'obsidian'
import type { TableOfContentsOptions } from './defaults.js'
import { getFormattedMarkdownHeading, isHeadingAllowed } from './markdown.js'

/**
 * Generate a table of contents markdown from a list of headings
 * @param headings - Array of heading objects from Obsidian's metadata cache
 * @param options - Configuration options for the table of contents
 * @returns Formatted markdown string for the table of contents
 */
export function getMarkdownFromHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): string {
  const markdownHandlersByStyle = {
    nestedList: getMarkdownNestedListFromHeadings,
    nestedOrderedList: getMarkdownNestedOrderedListFromHeadings,
    inlineFirstLevel: getMarkdownInlineFirstLevelFromHeadings,
  }
  let titleMarkdown = ''
  if (options.title && options.title.length > 0) {
    const titleSeparator = options.style === 'inlineFirstLevel' ? ' ' : '\n'
    titleMarkdown += `${options.title}${titleSeparator}`
  }
  const markdownHeadings = markdownHandlersByStyle[options.style](headings, options)
  if (markdownHeadings === null) {
    if (options.hideWhenEmpty) {
      return ''
    }
    return `${titleMarkdown}_Table of contents: no headings found_`
  }
  return titleMarkdown + markdownHeadings
}

export function getVisibleHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): HeadingCache[] {
  if (headings.length === 0) return []

  if (options.style === 'inlineFirstLevel') {
    return getVisibleInlineFirstLevelHeadings(headings, options)
  }

  return getVisibleNestedListHeadings(headings, options)
}

function getMarkdownNestedListFromHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): string | null {
  return getMarkdownListFromHeadings(headings, false, options)
}

function getMarkdownNestedOrderedListFromHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): string | null {
  return getMarkdownListFromHeadings(headings, true, options)
}

function getMarkdownListFromHeadings(
  headings: HeadingCache[],
  isOrdered: boolean,
  options: TableOfContentsOptions,
): string | null {
  const prefix = isOrdered ? '1.' : '-'
  const minLevel =
    options.minLevel > 0 ? options.minLevel : Math.min(...headings.map((heading) => heading.level))
  const lines = getVisibleNestedListHeadings(headings, options).map((heading) => {
    return `${'\t'.repeat(heading.level - minLevel)}${prefix} ${getFormattedMarkdownHeading(heading.heading, options)}`
  })

  return lines.length > 0 ? lines.join('\n') : null
}

function getMarkdownInlineFirstLevelFromHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): string | null {
  const items = getVisibleInlineFirstLevelHeadings(headings, options).map((heading) => {
    return getFormattedMarkdownHeading(heading.heading, options)
  })
  return items.length > 0 ? items.join(' | ') : null
}

function getVisibleNestedListHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): HeadingCache[] {
  if (headings.length === 0) return []

  const visibleHeadings: HeadingCache[] = []
  const minLevel =
    options.minLevel > 0 ? options.minLevel : Math.min(...headings.map((heading) => heading.level))
  let unallowedLevel = 0
  for (const heading of headings) {
    if (unallowedLevel > 0 && heading.level > unallowedLevel) continue
    if (heading.level <= unallowedLevel) {
      unallowedLevel = 0
    }
    if (!isHeadingAllowed(heading.heading, options)) {
      unallowedLevel = heading.level
      continue
    }
    if (heading.level < minLevel) continue
    if (options.maxLevel > 0 && heading.level > options.maxLevel) continue
    if (heading.heading.length === 0) continue
    visibleHeadings.push(heading)
  }

  return visibleHeadings
}

function getVisibleInlineFirstLevelHeadings(
  headings: HeadingCache[],
  options: TableOfContentsOptions,
): HeadingCache[] {
  if (headings.length === 0) return []

  const minLevel =
    options.minLevel > 0 ? options.minLevel : Math.min(...headings.map((heading) => heading.level))

  return headings
    .filter((heading) => heading.level === minLevel)
    .filter((heading) => heading.heading.length > 0)
    .filter((heading) => isHeadingAllowed(heading.heading, options))
}
