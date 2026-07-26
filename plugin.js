import {
  cn, haptic, host, Tip, useValue, atom, useQuery,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  ScrollArea, Skeleton, EmptyState, ErrorState
} from '@hermes/plugin-sdk'
import { jsx, jsxs, Fragment } from 'react/jsx-runtime'
import { useState } from 'react'

// ── Config ──────────────────────────────────────────────────────────────

var ID = 'hermes-dran'
var DRAN_URL = 'http://local-apps.vpn.cloud:4000'
var DRAN_TOKEN = 'q8iWR1kPXkqG15urMyL'
var DRAN_CONTEXT = 'personal'
var REFRESH_MS = 30000

function dranFetch(path) {
  return fetch(DRAN_URL + path, {
    headers: { Authorization: 'Bearer ' + DRAN_TOKEN }
  }).then(function (r) {
    if (!r.ok) throw new Error('Dran API error: ' + r.status)
    return r.json()
  })
}

// Build correct Dran web URL for a page type
function dranPageUrl(type, slug) {
  var typeMap = {
    project: 'projects',
    goal: 'goals',
    plan: 'plans',
    todo: 'todos',
    note: 'notes',
    concept: 'concepts',
    entity: 'entities',
    reference: 'references',
    comparison: 'queries',
    query: 'queries'
  }
  var route = typeMap[type] || 'pages'
  return DRAN_URL + '/' + route + '/' + encodeURIComponent(slug) + '?context=' + DRAN_CONTEXT
}

// Open URL in dev browser pane
function openInDevBrowser(url) {
  // Emit a window CustomEvent that the dev browser plugin listens for
  window.dispatchEvent(new CustomEvent('hermes:dev-browser:new-tab', {
    detail: { url: url }
  }))
}

// ── Atoms ────────────────────────────────────────────────────────────────

var $modalOpen = atom(false)

// ── Helpers ──────────────────────────────────────────────────────────────

function priorityColor(priority) {
  if (priority === 'urgent') return 'text-red-400'
  if (priority === 'high') return 'text-orange-400'
  if (priority === 'medium') return 'text-yellow-400'
  return 'text-(--ui-text-quaternary)'
}

// ── Data hooks ──────────────────────────────────────────────────────────

function useDranIndex() {
  return useQuery({
    queryKey: [ID, 'index'],
    queryFn: function () { return dranFetch('/api/index?context=' + DRAN_CONTEXT) },
    refetchInterval: REFRESH_MS,
  })
}

function useDranTodos() {
  return useQuery({
    queryKey: [ID, 'todos'],
    queryFn: function () { return dranFetch('/api/todos?context=' + DRAN_CONTEXT) },
    refetchInterval: REFRESH_MS,
  })
}

// ── Single chip ─────────────────────────────────────────────────────────

function DranChip() {
  var open = useValue($modalOpen)
  var { data, isLoading, error } = useDranIndex()

  var counts = { project: 0, goal: 0, plan: 0, todo: 0 }
  if (data && data.data) {
    data.data.forEach(function (p) {
      if (p.archived) return  // skip archived
      if (p.type === 'project') {
        var st = p.status
        if (st !== 'done' && st !== 'archived') counts.project++
      } else if (p.type === 'goal') {
        // skip goals with 100% progress
        if (p.progress !== 100 && p.progress !== '100') counts.goal++
      } else if (p.type === 'plan') {
        var pst = p.status
        if (pst !== 'done' && pst !== 'archived') counts.plan++
      }
    })
  }

  var activeTodos = 0
  var todoData = useDranTodos()
  if (todoData.data && todoData.data.data) {
    activeTodos = todoData.data.data.filter(function (t) {
      if (t.archived) return false
      var ks = t.meta && t.meta.kanban_status
      return ks !== 'done' && ks !== 'cancelled'
    }).length
  }

  var todosDisplay = todoData.isLoading ? '…' : todoData.error ? '!' : activeTodos
  var goalsDisplay = isLoading ? '…' : error ? '!' : counts.goal

  function dotStyle(active) {
    return {
      width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      backgroundColor: active ? '#22c55e' : 'var(--ui-text-quaternary)'
    }
  }

  return jsxs(Fragment, {
    children: [
      jsx(Tip, {
        label: 'Dran Brain',
        children: jsx('button', {
          className: cn(
            'inline-flex h-full items-center gap-2.5 px-1.5 text-[0.6875rem]',
            'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground',
            'tabular-nums'
          ),
          type: 'button',
          onClick: function () { $modalOpen.set(true) },
          children: jsxs('span', { className: 'inline-flex items-center gap-2.5', children: [
            jsxs('span', { className: 'inline-flex items-center gap-1', children: [
              'Todos',
              jsx('span', { style: dotStyle(activeTodos > 0) }),
              String(todosDisplay)
            ]}),
            jsxs('span', { className: 'inline-flex items-center gap-1', children: [
              'Goals',
              jsx('span', { style: dotStyle(counts.goal > 0) }),
              String(goalsDisplay)
            ]})
          ]})
        })
      }),
      jsx(DranModal, {})
    ]
  })
}

// ── Main modal with tabs ────────────────────────────────────────────────

var TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'plans', label: 'Plans' },
  { key: 'goals', label: 'Goals' },
  { key: 'projects', label: 'Projects' },
]

function DranModal() {
  var open = useValue($modalOpen)

  if (!open) return null

  return jsx(Dialog, {
    open: open,
    onOpenChange: function (v) { $modalOpen.set(v) },
    children: jsx(DialogContent, {
      fitContent: true,
      showCloseButton: true,
      className: 'p-0',
      children: jsx(DranModalContent, {})
    })
  })
}

function DranModalContent() {
  var [activeTab, setActiveTab] = useState('todos')
  var { data: indexData } = useDranIndex()
  var { data: todoData } = useDranTodos()

  // Calculate counts per tab
  var tabCounts = { projects: 0, goals: 0, plans: 0, todos: 0 }
  if (indexData && indexData.data) {
    indexData.data.forEach(function (p) {
      if (p.archived) return
      if (p.type === 'project') {
        var st = p.status
        if (st !== 'done' && st !== 'archived') tabCounts.projects++
      } else if (p.type === 'goal') {
        if (p.progress !== 100 && p.progress !== '100') tabCounts.goals++
      } else if (p.type === 'plan') {
        var pst = p.status
        if (pst !== 'done' && pst !== 'archived') tabCounts.plans++
      }
    })
  }
  if (todoData && todoData.data) {
    tabCounts.todos = todoData.data.filter(function (t) {
      if (t.archived) return false
      var ks = t.meta && t.meta.kanban_status
      return ks !== 'done' && ks !== 'cancelled'
    }).length
  }

  return jsxs('div', {
    className: 'flex flex-col overflow-hidden',
    style: { height: '80vh', width: 'min(94vw, 1200px)' },
    children: [
      // Tabs bar with counts
      jsx('div', {
        className: 'flex items-center gap-0.5 px-2 py-1.5 border-b border-(--ui-stroke-secondary) shrink-0',
        children: TABS.map(function (tab) {
          var count = tabCounts[tab.key] || 0
          return jsx('button', {
            className: cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              'inline-flex items-center gap-1.5',
              activeTab === tab.key
                ? 'bg-(--ui-accent) text-white'
                : 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
            ),
            onClick: function () { setActiveTab(tab.key) },
            children: jsxs(Fragment, { children: [
              tab.label,
              jsx('span', { className: cn(
                'text-[0.625rem] tabular-nums px-1 rounded-full',
                activeTab === tab.key ? 'bg-white/20' : 'bg-(--ui-stroke-secondary)'
              ), children: String(count) })
            ]})
          }, tab.key)
        })
      }),
      // Content area
      jsx('div', { className: 'flex-1 overflow-hidden', children: 
        activeTab === 'projects' ? jsx(ProjectsTab, {}) :
        activeTab === 'goals' ? jsx(GoalsTab, {}) :
        activeTab === 'plans' ? jsx(PlansTab, {}) :
        activeTab === 'todos' ? jsx(TodosTab, {}) :
        null
      })
    ]
  })
}

// ── Projects / Goals / Plans tabs ───────────────────────────────────────

function ProjectsTab() { return jsx(ListTab, { type: 'project', emptyMsg: 'No projects' }) }
function GoalsTab() { return jsx(ListTab, { type: 'goal', emptyMsg: 'No goals' }) }
function PlansTab() { return jsx(ListTab, { type: 'plan', emptyMsg: 'No plans' }) }

function ListTab(_ref) {
  var type = _ref.type
  var emptyMsg = _ref.emptyMsg
  var { data, isLoading, error } = useDranIndex()
  var items = data && data.data ? data.data.filter(function (p) {
    if (p.type !== type) return false
    if (p.archived) return false
    if (type === 'project' || type === 'plan') {
      var st = p.status
      return st !== 'done' && st !== 'archived'
    }
    if (type === 'goal') {
      return p.progress !== 100 && p.progress !== '100'
    }
    return true
  }) : []

  if (isLoading) return jsx('div', { className: 'flex-1 flex items-center justify-center', children: jsx(Skeleton, { className: 'h-32 w-3/4' }) })
  if (error) return jsx('div', { className: 'flex-1 flex items-center justify-center p-4', children: jsx(ErrorState, { message: 'Failed to load' }) })
  if (items.length === 0) return jsx('div', { className: 'flex-1 flex items-center justify-center', children: jsx(EmptyState, { title: 'Empty', description: emptyMsg }) })

  return jsx(ScrollArea, {
    className: 'h-full',
    children: jsx('div', {
      className: 'p-3 space-y-1',
      children: items.map(function (item) {
        return jsxs('button', {
          className: 'w-full flex items-center justify-between gap-2 rounded-md border border-(--ui-stroke-secondary) px-3 py-2 hover:bg-(--chrome-action-hover) transition-colors text-left',
          onClick: function () {
            haptic('tap')
            openInDevBrowser(dranPageUrl(type, item.slug))
          },
          children: [
            jsxs('div', { className: 'flex items-center gap-2 min-w-0', children: [
              jsx('span', { className: 'size-1.5 rounded-full shrink-0 bg-(--ui-accent)' }),
              jsx('span', { className: 'truncate text-sm font-medium', children: item.title })
            ]}),
            jsx('span', { className: 'text-(--ui-text-quaternary) shrink-0 text-xs', children: '›' })
          ]
        }, item.slug)
      })
    })
  })
}

// ── Todos tab (kanban) ─────────────────────────────────────────────────

var KANBAN_COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'this_week', label: 'This Week' },
  { key: 'today', label: 'Today' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

function TodosTab() {
  var { data, isLoading, error } = useDranTodos()
  var todos = data && data.data ? data.data.filter(function (t) {
    if (t.archived) return false
    var ks = (t.meta && t.meta.kanban_status) || 'backlog'
    return ks !== 'cancelled'
  }) : []

  var grouped = {}
  KANBAN_COLUMNS.forEach(function (col) { grouped[col.key] = [] })
  todos.forEach(function (t) {
    var ks = (t.meta && t.meta.kanban_status) || 'backlog'
    if (!grouped[ks]) grouped[ks] = []
    grouped[ks].push(t)
  })

  if (isLoading) return jsx('div', { className: 'flex-1 flex items-center justify-center', children: jsx(Skeleton, { className: 'h-32 w-3/4' }) })
  if (error) return jsx('div', { className: 'flex-1 flex items-center justify-center p-4', children: jsx(ErrorState, { message: 'Failed to load todos' }) })
  if (todos.length === 0) return jsx('div', { className: 'flex-1 flex items-center justify-center', children: jsx(EmptyState, { title: 'No todos', description: 'No todos in Dran' }) })

  return jsx(ScrollArea, {
    className: 'h-full',
    children: jsx('div', {
      className: 'flex gap-3 p-3 min-w-max',
      children: KANBAN_COLUMNS.map(function (col) {
        var colTodos = grouped[col.key] || []
        return jsxs('div', {
          className: 'flex w-64 flex-col gap-2 shrink-0',
          children: [
            jsxs('div', {
              className: 'flex items-center justify-between px-2 py-1',
              children: [
                jsx('span', { className: 'text-xs font-medium text-(--ui-text-secondary)', children: col.label }),
                jsx('span', { className: 'text-[0.625rem] tabular-nums text-(--ui-text-quaternary)', children: '(' + String(colTodos.length) + ')' })
              ]
            }),
            jsx('div', {
              className: 'flex flex-col gap-2 flex-1',
              children: colTodos.length === 0
                ? [jsx('div', { key: 'empty', className: 'text-[0.625rem] text-(--ui-text-quaternary) text-center py-4', children: '—' })]
                : colTodos.map(function (t) { return jsx(TodoCard, { key: t.id, todo: t }) })
            })
          ]
        }, col.key)
      })
    })
  })
}

function TodoCard(_ref) {
  var todo = _ref.todo
  var priority = todo.meta && todo.meta.priority
  var assignee = todo.meta && todo.meta.assignee

  return jsx('button', {
    className: 'w-full text-left rounded-md border border-(--ui-stroke-secondary) px-2.5 py-2 hover:border-(--ui-accent) transition-colors',
    style: { backgroundColor: 'var(--ui-chat-bubble-background)' },
    onClick: function () {
      haptic('tap')
      openInDevBrowser(dranPageUrl('todo', todo.slug))
    },
    children: jsxs('div', { className: 'space-y-1', children: [
      jsx('p', { className: 'text-xs font-medium leading-tight line-clamp-2', children: todo.title }),
      jsxs('div', { className: 'flex items-center gap-1.5', children: [
        priority ? jsx('span', { className: cn('text-[0.5625rem] uppercase', priorityColor(priority)), children: priority }) : null,
        assignee ? jsxs('span', { className: 'text-[0.5625rem] text-(--ui-text-quaternary)', children: ['@', assignee] }) : null
      ]})
    ]})
  })
}

// ── Export ───────────────────────────────────────────────────────────────

export default {
  id: ID,
  name: 'Dran',
  register: function (ctx) {
    ctx.register({
      id: ID + '-chip',
      area: 'statusBar.right',
      order: 130,
      render: function () { return jsx(DranChip, {}) }
    })
  }
}
