import type {
  App,
  CachedMetadata,
  Editor,
  HeadingCache,
  MarkdownFileInfo,
  TFile,
  WorkspaceLeaf,
} from 'obsidian'
import { getMarkdownFromHeadings, getVisibleHeadings } from './headings.js'
import { MarkdownRenderChild, MarkdownRenderer, Plugin } from './obsidian.js'
import { getOptionsDocs, type PluginSettings, parseOptionsFromSourceText } from './options.js'
import { DEFAULT_SETTINGS, SettingsTab } from './settings.js'
import { filterHeadingsInDisplayMath, getHeadingsFromSource } from './source.js'

const codeblockId = 'table-of-contents'
const codeblockIdShort = 'toc'

interface ProcessorContext {
  sourcePath: string
  addChild: (child: any) => void
}

class ObsidianAutomaticTableOfContents extends Plugin {
  settings!: PluginSettings

  async onload(): Promise<void> {
    await this.loadSettings()

    const handler = (sourceText: string, element: HTMLElement, context: ProcessorContext) => {
      context.addChild(
        new Renderer(this.app, element, context.sourcePath, sourceText, this.settings),
      )
    }
    this.registerMarkdownCodeBlockProcessor(codeblockId, handler)
    this.registerMarkdownCodeBlockProcessor(codeblockIdShort, handler)
    this.addCommand({
      id: 'insert-automatic-table-of-contents',
      name: 'Insert table of contents',
      editorCallback: onInsertToc,
    })
    this.addCommand({
      id: 'insert-automatic-table-of-contents-docs',
      name: 'Insert table of contents (with available options)',
      editorCallback: onInsertTocWithDocs,
    })
    this.addSettingTab(new SettingsTab(this.app, this))
  }

  onunload(): void {
    // Cleanup is handled automatically by registerMarkdownCodeBlockProcessor,
    // registerEvent, and addCommand
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }
}

function onInsertToc(editor: Editor, _view: MarkdownFileInfo): void {
  const markdown = `\`\`\`${codeblockId}\n\`\`\``
  editor.replaceRange(markdown, editor.getCursor())
}

function onInsertTocWithDocs(editor: Editor, _view: MarkdownFileInfo): void {
  const markdown = [`\`\`\`${codeblockId}\n${getOptionsDocs()}\n\`\`\``]
  editor.replaceRange(markdown.join('\n'), editor.getCursor())
}

class Renderer extends MarkdownRenderChild {
  app: App
  element: HTMLElement
  sourcePath: string
  sourceText: string
  pluginSettings: PluginSettings
  renderVersion = 0

  constructor(
    app: App,
    element: HTMLElement,
    sourcePath: string,
    sourceText: string,
    pluginSettings: PluginSettings,
  ) {
    super(element)
    this.app = app
    this.element = element
    this.sourcePath = sourcePath
    this.sourceText = sourceText
    this.pluginSettings = pluginSettings
  }

  // Render on load
  onload(): void {
    void this.render()
    this.registerDomEvent(
      this.element,
      'click',
      (event: MouseEvent) => {
        void this.onClick(event)
      },
      { capture: true },
    )
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        // Only re-render if the current file has changed
        if (file.path === this.sourcePath) {
          this.onMetadataChange()
        }
      }),
    )
  }

  // Render on file change
  onMetadataChange(): void {
    void this.render()
  }

  async render(): Promise<void> {
    this.renderVersion += 1
    const renderVersion = this.renderVersion

    try {
      const options = parseOptionsFromSourceText(this.sourceText, this.pluginSettings)
      if (options.debugInConsole) debug('Options', options)

      const metadata: CachedMetadata | null = this.app.metadataCache.getCache(this.sourcePath)
      const cachedHeadings: HeadingCache[] = metadata?.headings ? metadata.headings : []
      const fileSourceText = await this.readSourceText()
      if (renderVersion !== this.renderVersion) return

      const headings =
        fileSourceText !== null
          ? getHeadingsFromSource(fileSourceText)
          : filterHeadingsInDisplayMath(cachedHeadings, fileSourceText)
      if (options.debugInConsole) debug('Headings', headings)

      const markdown = getMarkdownFromHeadings(headings, options)
      if (options.debugInConsole) debug('Markdown', markdown)
      ;(this.element as any).empty()
      await MarkdownRenderer.renderMarkdown(markdown, this.element, this.sourcePath, this)
      if (renderVersion !== this.renderVersion) return
      if (fileSourceText !== null && options.includeLinks) {
        this.bindHeadingLinks(getVisibleHeadings(headings, options))
      }
    } catch (error) {
      debug('Error', error)
      const message = error instanceof Error ? error.message : String(error)
      const readableError = `_💥 Could not render table of contents (${message})_`
      await MarkdownRenderer.renderMarkdown(readableError, this.element, this.sourcePath, this)
    }
  }

  async readSourceText(): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(this.sourcePath)
    if (file === null) return null

    try {
      return await this.app.vault.cachedRead(file as TFile)
    } catch (error) {
      debug('Source read error', error)
      return null
    }
  }

  bindHeadingLinks(headings: HeadingCache[]): void {
    const links = Array.from(this.element.querySelectorAll<HTMLAnchorElement>('a.internal-link'))
      .filter((link) => link.dataset.href?.includes('#'))
      .slice(0, headings.length)

    links.forEach((link, index) => {
      const heading = headings[index]
      if (!heading) return

      link.dataset.tocLine = String(heading.position.start.line)
    })
  }

  async onClick(event: MouseEvent): Promise<void> {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const link = target.closest<HTMLAnchorElement>('a[data-toc-line]')
    if (!link?.dataset.tocLine) return

    const line = Number.parseInt(link.dataset.tocLine, 10)
    if (Number.isNaN(line)) return

    event.preventDefault()
    event.stopPropagation()
    await this.navigateToLine(line)
  }

  async navigateToLine(line: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.sourcePath)
    if (file === null) return

    const leaf = this.getOpenMarkdownLeafForSourcePath() ?? this.app.workspace.getLeaf(false)

    await leaf.openFile(file as TFile, { active: true, eState: { line } })
    await leaf.loadIfDeferred()
    await this.app.workspace.revealLeaf(leaf)

    const view = leaf.view as { editor?: Editor }
    if (!view.editor) return

    const position = { line, ch: 0 }
    view.editor.setCursor(position)
    view.editor.scrollIntoView({ from: position, to: position }, true)
  }

  getOpenMarkdownLeafForSourcePath(): WorkspaceLeaf | null {
    const activeLeaf = this.app.workspace.activeLeaf
    if (activeLeaf && (activeLeaf.view as any).file?.path === this.sourcePath) {
      return activeLeaf
    }

    return (
      this.app.workspace
        .getLeavesOfType('markdown')
        .find((leaf) => (leaf.view as any).file?.path === this.sourcePath) ?? null
    )
  }
}

function debug(type: string, data: unknown): void {
  console.log(
    ...[
      `%cAutomatic Table Of Contents %c${type}:\n`,
      'color: orange; font-weight: bold',
      'font-weight: bold',
      data,
    ],
  )
}

export default ObsidianAutomaticTableOfContents
