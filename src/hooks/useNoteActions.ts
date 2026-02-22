import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, addMockEntry, updateMockContent } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { useTabManagement } from './useTabManagement'
import { updateMockFrontmatter, deleteMockFrontmatterProperty } from './mockFrontmatterHelpers'

interface NewEntryParams {
  path: string
  slug: string
  title: string
  type: string
  status: string | null
}

function buildNewEntry({ path, slug, title, type, status }: NewEntryParams): VaultEntry {
  const now = Math.floor(Date.now() / 1000)
  return {
    path, filename: `${slug}.md`, title, isA: type,
    aliases: [], belongsTo: [], relatedTo: [],
    status, owner: null, cadence: null, archived: false, trashed: false, trashedAt: null,
    modifiedAt: now, createdAt: now, fileSize: 0,
    snippet: '', relationships: {}, icon: null, color: null, order: null,
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function entryMatchesTarget(e: VaultEntry, targetLower: string, targetAsWords: string): boolean {
  if (e.title.toLowerCase() === targetLower) return true
  if (e.aliases.some((a) => a.toLowerCase() === targetLower)) return true
  const pathStem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
  if (pathStem.toLowerCase() === targetLower) return true
  const fileStem = e.filename.replace(/\.md$/, '')
  if (fileStem.toLowerCase() === targetLower.split('/').pop()) return true
  return e.title.toLowerCase() === targetAsWords
}

async function invokeFrontmatter(command: string, args: Record<string, unknown>): Promise<string> {
  return invoke<string>(command, args)
}

function applyMockFrontmatterUpdate(path: string, key: string, value: FrontmatterValue): string {
  const content = updateMockFrontmatter(path, key, value)
  updateMockContent(path, content)
  return content
}

function applyMockFrontmatterDelete(path: string, key: string): string {
  const content = deleteMockFrontmatterProperty(path, key)
  updateMockContent(path, content)
  return content
}

const TYPE_FOLDER_MAP: Record<string, string> = {
  Note: 'note', Project: 'project', Experiment: 'experiment',
  Responsibility: 'responsibility', Procedure: 'procedure',
  Person: 'person', Event: 'event', Topic: 'topic',
}

const NO_STATUS_TYPES = new Set(['Topic', 'Person'])

function addEntryWithMock(entry: VaultEntry, content: string, addEntry: (e: VaultEntry, c: string) => void) {
  if (!isTauri()) addMockEntry(entry, content)
  addEntry(entry, content)
}

export function useNoteActions(
  addEntry: (entry: VaultEntry, content: string) => void,
  updateContent: (path: string, content: string) => void,
  entries: VaultEntry[],
  setToastMessage: (msg: string | null) => void,
) {
  const tabMgmt = useTabManagement()
  const { tabs, setTabs, handleSelectNote } = tabMgmt

  const updateTabContent = useCallback((path: string, newContent: string) => {
    setTabs((prev) => prev.map((t) =>
      t.entry.path === path ? { ...t, content: newContent } : t
    ))
    updateContent(path, newContent)
  }, [setTabs, updateContent])

  const handleNavigateWikilink = useCallback((target: string) => {
    const targetLower = target.toLowerCase()
    const targetAsWords = target.split('/').pop()?.replace(/-/g, ' ').toLowerCase() ?? targetLower

    const found = entries.find((e) => entryMatchesTarget(e, targetLower, targetAsWords))
    if (found) handleSelectNote(found)
    else console.warn(`Navigation target not found: ${target}`)
  }, [entries, handleSelectNote])

  const handleCreateNote = useCallback(async (title: string, type: string) => {
    const folder = TYPE_FOLDER_MAP[type] || slugify(type)
    const slug = slugify(title)
    const status = NO_STATUS_TYPES.has(type) ? null : 'Active'
    const newEntry = buildNewEntry({ path: `/Users/luca/Laputa/${folder}/${slug}.md`, slug, title, type, status })

    const frontmatter = [
      '---', `title: ${title}`, `is_a: ${type}`,
      ...(status ? [`status: ${status}`] : []),
      '---',
    ].join('\n')

    addEntryWithMock(newEntry, `${frontmatter}\n\n# ${title}\n\n`, addEntry)
    handleSelectNote(newEntry)
  }, [handleSelectNote, addEntry])

  const handleCreateType = useCallback(async (typeName: string) => {
    const slug = slugify(typeName)
    const newEntry = buildNewEntry({ path: `/Users/luca/Laputa/type/${slug}.md`, slug, title: typeName, type: 'Type', status: null })
    addEntryWithMock(newEntry, `---\nIs A: Type\n---\n\n# ${typeName}\n\n`, addEntry)
    handleSelectNote(newEntry)
  }, [handleSelectNote, addEntry])

  const handleUpdateFrontmatter = useCallback(async (path: string, key: string, value: FrontmatterValue) => {
    try {
      const newContent = isTauri()
        ? await invokeFrontmatter('update_frontmatter', { path, key, value })
        : applyMockFrontmatterUpdate(path, key, value)
      updateTabContent(path, newContent)
      setToastMessage('Property updated')
    } catch (err) {
      console.error('Failed to update frontmatter:', err)
      setToastMessage('Failed to update property')
    }
  }, [updateTabContent, setToastMessage])

  const handleDeleteProperty = useCallback(async (path: string, key: string) => {
    try {
      const newContent = isTauri()
        ? await invokeFrontmatter('delete_frontmatter_property', { path, key })
        : applyMockFrontmatterDelete(path, key)
      updateTabContent(path, newContent)
      setToastMessage('Property deleted')
    } catch (err) {
      console.error('Failed to delete property:', err)
      setToastMessage('Failed to delete property')
    }
  }, [updateTabContent, setToastMessage])

  const handleAddProperty = useCallback(async (path: string, key: string, value: FrontmatterValue) => {
    return handleUpdateFrontmatter(path, key, value)
  }, [handleUpdateFrontmatter])

  return {
    tabs,
    activeTabPath: tabMgmt.activeTabPath,
    activeTabPathRef: tabMgmt.activeTabPathRef,
    handleCloseTabRef: tabMgmt.handleCloseTabRef,
    handleSelectNote,
    handleCloseTab: tabMgmt.handleCloseTab,
    handleSwitchTab: tabMgmt.handleSwitchTab,
    handleReorderTabs: tabMgmt.handleReorderTabs,
    handleNavigateWikilink,
    handleCreateNote,
    handleCreateType,
    handleUpdateFrontmatter,
    handleDeleteProperty,
    handleAddProperty,
    handleReplaceActiveTab: tabMgmt.handleReplaceActiveTab,
    closeAllTabs: tabMgmt.closeAllTabs,
  }
}
