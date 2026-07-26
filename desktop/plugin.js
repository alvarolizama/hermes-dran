import {
  cn, haptic, host, Tip, useValue, atom, useQuery,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  ScrollArea, Skeleton, EmptyState, ErrorState
} from '@hermes/plugin-sdk'
import { jsx, jsxs, Fragment } from 'react/jsx-runtime'
import { useState, useRef, useEffect } from 'react'

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

// PUT with body — for status/archive/progress updates
function dranPut(path, body) {
  return fetch(DRAN_URL + path, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + DRAN_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
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

var PROJECT_STATUSES = ['draft', 'active', 'on_hold', 'done']
var PLAN_STATUSES = ['draft', 'active', 'done']

function statusColor(status) {
  if (status === 'done') return 'text-green-400'
  if (status === 'active') return 'text-blue-400'
  if (status === 'on_hold') return 'text-yellow-400'
  if (status === 'draft') return 'text-(--ui-text-quaternary)'
  return 'text-(--ui-text-quaternary)'
}

// Normalize progress: API stores 0.0–1.0, UI shows 0–100
function progressToPercent(val) {
  if (val == null) return 0
  var num = Number(val)
  if (isNaN(num)) return 0
  return num <= 1 ? Math.round(num * 100) : Math.round(num)
}

function percentToProgress(pct) {
  return pct / 100
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

// ── Mutation helpers ────────────────────────────────────────────────────

// Update a page's meta field — fetches current page, merges meta, sends PUT
function updatePageMeta(slug, metaKey, metaValue) {
  return dranFetch('/api/pages/' + encodeURIComponent(slug) + '?context=' + DRAN_CONTEXT)
    .then(function (res) {
      var page = res.data
      var currentMeta = page.meta || {}
      var newMeta = {}
      newMeta[metaKey] = metaValue
      // Merge: current meta + new field
      var mergedMeta = Object.assign({}, currentMeta, newMeta)
      return dranPut('/api/pages/' + encodeURIComponent(slug) + '?context=' + DRAN_CONTEXT, {
        meta: mergedMeta
      })
    })
}

// Archive a page — PUT archived: true
function archivePage(slug) {
  return dranPut('/api/pages/' + encodeURIComponent(slug) + '?context=' + DRAN_CONTEXT, {
    archived: true
  })
}

function useDranPages(pageType) {
  return useQuery({
    queryKey: [ID, 'pages', pageType],
    queryFn: function () { return dranFetch('/api/pages?type=' + pageType + '&context=' + DRAN_CONTEXT) },
    refetchInterval: REFRESH_MS,
  })
}

// ── Single chip ─────────────────────────────────────────────────────────

function DranChip() {
  var open = useValue($modalOpen)
  var goalQuery = useDranPages('goal')
  var planQuery = useDranPages('plan')

  var goalCount = 0
  if (goalQuery.data && goalQuery.data.data) {
    goalCount = goalQuery.data.data.filter(function (g) {
      return !g.archived
    }).length
  }

  var planCount = 0
  if (planQuery.data && planQuery.data.data) {
    planCount = planQuery.data.data.filter(function (p) {
      if (p.archived) return false
      var st = (p.meta || {}).status
      return st !== 'done'
    }).length
  }

  var activeTodos = 0
  var todoData = useDranTodos()
  if (todoData.data && todoData.data) {
    activeTodos = todoData.data.data.filter(function (t) {
      if (t.archived) return false
      var ks = t.meta && t.meta.kanban_status
      return ks !== 'done' && ks !== 'cancelled'
    }).length
  }

  var todosDisplay = todoData.isLoading ? '…' : todoData.error ? '!' : activeTodos
  var plansDisplay = planQuery.isLoading ? '…' : planQuery.error ? '!' : planCount
  var goalsDisplay = goalQuery.isLoading ? '…' : goalQuery.error ? '!' : goalCount

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
              'Plans',
              jsx('span', { style: dotStyle(planCount > 0) }),
              String(plansDisplay)
            ]}),
            jsxs('span', { className: 'inline-flex items-center gap-1', children: [
              'Goals',
              jsx('span', { style: dotStyle(goalCount > 0) }),
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
  var projectQuery = useDranPages('project')
  var goalQuery = useDranPages('goal')
  var planQuery = useDranPages('plan')
  var { data: todoData } = useDranTodos()

  // Calculate counts per tab
  var tabCounts = { projects: 0, goals: 0, plans: 0, todos: 0 }
  if (projectQuery.data && projectQuery.data.data) {
    tabCounts.projects = projectQuery.data.data.filter(function (p) {
      return !p.archived
    }).length
  }
  if (goalQuery.data && goalQuery.data.data) {
    tabCounts.goals = goalQuery.data.data.filter(function (g) {
      return !g.archived
    }).length
  }
  if (planQuery.data && planQuery.data.data) {
    tabCounts.plans = planQuery.data.data.filter(function (p) {
      return !p.archived
    }).length
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
  var query = useDranPages(type)
  var { data, isLoading, error } = query
  var items = data && data.data ? data.data.filter(function (p) {
    if (p.archived) return false
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
        return jsx(ListItem, {
          key: item.slug,
          item: item,
          type: type,
          query: query,
        })
      })
    })
  })
}

// ── List item with status/archive/progress controls ────────────────────

function ListItem(_ref) {
  var item = _ref.item
  var type = _ref.type
  var query = _ref.query
  var meta = item.meta || {}

  return jsxs('div', {
    className: 'flex items-center justify-between gap-2 rounded-md border border-(--ui-stroke-secondary) px-3 py-2 hover:bg-(--chrome-action-hover) transition-colors',
    children: [
      jsxs('button', {
        className: 'flex items-center gap-2 min-w-0 flex-1 text-left',
        onClick: function () {
          haptic('tap')
          openInDevBrowser(dranPageUrl(type, item.slug))
        },
        children: [
          jsx('span', { className: 'size-1.5 rounded-full shrink-0 bg-(--ui-accent)' }),
          jsx('span', { className: 'truncate text-sm font-medium', children: item.title })
        ]
      }),
      jsxs('div', { className: 'flex items-center gap-1.5 shrink-0', children: [
        // Status / progress controls depend on type
        type === 'project' ? jsx(StatusDropdown, {
          slug: item.slug,
          currentStatus: meta.status || 'draft',
          statuses: PROJECT_STATUSES,
          query: query,
        }) : null,
        type === 'plan' ? jsx(StatusDropdown, {
          slug: item.slug,
          currentStatus: meta.status || 'draft',
          statuses: PLAN_STATUSES,
          query: query,
        }) : null,
        type === 'goal' ? jsx(ProgressControl, {
          slug: item.slug,
          currentProgress: meta.progress,
          query: query,
        }) : null,
        // Archive button — always available
        jsx(ArchiveButton, {
          slug: item.slug,
          query: query,
        })
      ]})
    ]
  })
}

// ── Status dropdown (projects & plans) ───────────────────────────────────

function StatusDropdown(_ref) {
  var slug = _ref.slug
  var currentStatus = _ref.currentStatus
  var statuses = _ref.statuses
  var query = _ref.query

  var [open, setOpen] = useState(false)
  var [updating, setUpdating] = useState(false)
  var ref = useRef(null)

  useEffect(function () {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return function () { document.removeEventListener('mousedown', handler) }
  }, [open])

  function changeStatus(newStatus) {
    setOpen(false)
    if (newStatus === currentStatus) return
    setUpdating(true)
    updatePageMeta(slug, 'status', newStatus)
      .then(function () {
        if (query.refetch) query.refetch()
      })
      .catch(function (err) {
        console.error('Failed to update status:', err)
      })
      .finally(function () {
        setUpdating(false)
      })
  }

  return jsxs('div', { ref: ref, className: 'relative', children: [
    jsx('button', {
      className: cn(
        'text-[0.625rem] px-1.5 py-0.5 rounded transition-colors',
        'border border-(--ui-stroke-secondary) hover:bg-(--chrome-action-hover)',
        statusColor(currentStatus),
        updating && 'opacity-50'
      ),
      onClick: function (e) {
        e.stopPropagation()
        setOpen(!open)
      },
      children: updating ? '…' : currentStatus
    }),
    open ? jsxs('div', {
      className: 'absolute top-full right-0 mt-1 z-50 rounded-md border border-(--ui-stroke-secondary)',
      style: { backgroundColor: 'var(--ui-popover-background, var(--ui-chat-bubble-background))' },
      children: statuses.map(function (st) {
        return jsx('button', {
          className: cn(
            'block w-full text-left px-2 py-1 text-[0.625rem] hover:bg-(--chrome-action-hover) transition-colors',
            'first:rounded-t-md last:rounded-b-md',
            st === currentStatus ? 'text-(--ui-accent) font-medium' : statusColor(st)
          ),
          onClick: function (e) {
            e.stopPropagation()
            changeStatus(st)
          },
          children: st
        }, st)
      })
    }) : null
  ]})
}

// ── Progress control (goals) ────────────────────────────────────────────

function ProgressControl(_ref) {
  var slug = _ref.slug
  var currentProgress = _ref.currentProgress
  var query = _ref.query

  var pct = progressToPercent(currentProgress)
  var [editing, setEditing] = useState(false)
  var [value, setValue] = useState(pct)
  var [updating, setUpdating] = useState(false)
  var ref = useRef(null)

  useEffect(function () {
    if (!editing) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setEditing(false)
    }
    document.addEventListener('mousedown', handler)
    return function () { document.removeEventListener('mousedown', handler) }
  }, [editing])

  function save(newPct) {
    var clamped = Math.max(0, Math.min(100, newPct))
    if (clamped === pct) {
      setEditing(false)
      return
    }
    setUpdating(true)
    updatePageMeta(slug, 'progress', percentToProgress(clamped))
      .then(function () {
        if (query.refetch) query.refetch()
      })
      .catch(function (err) {
        console.error('Failed to update progress:', err)
      })
      .finally(function () {
        setUpdating(false)
        setEditing(false)
      })
  }

  return jsxs('div', { ref: ref, className: 'relative', children: [
    jsx('button', {
      className: cn(
        'text-[0.625rem] px-1.5 py-0.5 rounded transition-colors',
        'border border-(--ui-stroke-secondary) hover:bg-(--chrome-action-hover)',
        'text-(--ui-text-tertiary) tabular-nums',
        updating && 'opacity-50'
      ),
      onClick: function (e) {
        e.stopPropagation()
        setValue(pct)
        setEditing(!editing)
      },
      children: updating ? '…' : (pct + '%')
    }),
    editing ? jsxs('div', {
      className: 'absolute top-full right-0 mt-1 z-50 rounded-md border border-(--ui-stroke-secondary) p-2',
      style: { backgroundColor: 'var(--ui-popover-background, var(--ui-chat-bubble-background))' },
      children: [
        jsx('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 5,
          value: value,
          onChange: function (e) { setValue(Number(e.target.value)) },
          onMouseUp: function () { save(value) },
          onTouchEnd: function () { save(value) },
          className: 'w-28 accent-(--ui-accent)',
          style: { accentColor: 'var(--ui-accent)' }
        }),
        jsxs('div', {
          className: 'flex items-center justify-between mt-1.5 gap-2',
          children: [
            jsxs('span', { className: 'text-[0.625rem] text-(--ui-text-tertiary) tabular-nums', children: [value, '%'] }),
            jsx('button', {
              className: 'text-[0.625rem] px-1.5 py-0.5 rounded bg-(--ui-accent) text-white hover:opacity-80 transition-opacity',
              onClick: function (e) {
                e.stopPropagation()
                save(value)
              },
              children: 'OK'
            })
          ]
        })
      ]
    }) : null
  ]})
}

// ── Archive button ───────────────────────────────────────────────────────

function ArchiveButton(_ref) {
  var slug = _ref.slug
  var query = _ref.query

  var [updating, setUpdating] = useState(false)

  function handleArchive(e) {
    e.stopPropagation()
    setUpdating(true)
    archivePage(slug)
      .then(function () {
        if (query.refetch) query.refetch()
      })
      .catch(function (err) {
        console.error('Failed to archive:', err)
      })
      .finally(function () {
        setUpdating(false)
      })
  }

  return jsx('button', {
    className: cn(
      'text-[0.625rem] px-1.5 py-0.5 rounded transition-colors',
      'border border-(--ui-stroke-secondary) hover:bg-(--chrome-action-hover)',
      'text-(--ui-text-quaternary)',
      updating && 'opacity-50'
    ),
    onClick: handleArchive,
    title: 'Archive',
    children: updating ? '…' : '⊠'
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

  return jsx('div', {
    className: 'h-full overflow-hidden',
    children: jsx('div', {
      className: 'flex gap-3 p-3 h-full',
      children: KANBAN_COLUMNS.map(function (col) {
        var colTodos = grouped[col.key] || []
        return jsxs('div', {
          className: 'flex flex-1 min-w-0 flex-col gap-2 shrink-0 h-full',
          children: [
            jsxs('div', {
              className: 'flex items-center justify-between px-2 py-1 shrink-0',
              children: [
                jsx('span', { className: 'text-xs font-medium text-(--ui-text-secondary)', children: col.label }),
                jsx('span', { className: 'text-[0.625rem] tabular-nums text-(--ui-text-quaternary)', children: '(' + String(colTodos.length) + ')' })
              ]
            }),
            jsx(ScrollArea, {
              className: 'flex-1 min-h-0',
              children: jsx('div', {
                className: 'flex flex-col gap-2',
                children: colTodos.length === 0
                  ? [jsx('div', { key: 'empty', className: 'text-[0.625rem] text-(--ui-text-quaternary) text-center py-4', children: '—' })]
                  : colTodos.map(function (t) { return jsx(TodoCard, { key: t.id, todo: t }) })
              })
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
