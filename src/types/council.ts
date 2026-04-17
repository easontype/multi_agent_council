// Agent 定义
export interface Agent {
  id: string
  name: string
  role: string
  color: string
  avatar: string // 首字母或 emoji
}

// Academic critique roles (aligned with council-academic.ts seat roles)
export const AGENTS: Agent[] = [
  { id: 'methods',      name: 'Methods Critic',        role: 'Methodology',    color: '#6366f1', avatar: 'M' },
  { id: 'literature',   name: 'Literature Auditor',    role: 'Literature',     color: '#8b5cf6', avatar: 'L' },
  { id: 'replication',  name: 'Replication Skeptic',   role: 'Reproducibility',color: '#06b6d4', avatar: 'R' },
  { id: 'contribution', name: 'Contribution Evaluator',role: 'Novelty',        color: '#f59e0b', avatar: 'C' },
  { id: 'advocate',     name: 'Constructive Advocate', role: 'Advocate',       color: '#10b981', avatar: 'A' },
  { id: 'gap',          name: 'Gap Finder',            role: 'Gaps',           color: '#6366f1', avatar: 'G' },
  { id: 'hostile',      name: 'Hostile Reviewer',      role: 'Hostile Review', color: '#ef4444', avatar: 'H' },
  { id: 'methods2',     name: 'Methods Auditor',       role: 'Methods Audit',  color: '#06b6d4', avatar: 'A' },
  { id: 'scout',        name: 'Related Work Scout',    role: 'Related Work',   color: '#f59e0b', avatar: 'S' },
  { id: 'mentor',       name: 'Supportive Mentor',     role: 'Mentor',         color: '#10b981', avatar: 'M' },
  { id: 'moderator',    name: 'Moderator',             role: 'Synthesis',      color: '#94a3b8', avatar: '◆' },
]

// Map SSE role strings → agent id
export const ROLE_TO_AGENT_ID: Record<string, string> = {
  'Methods Critic':        'methods',
  'Literature Auditor':    'literature',
  'Replication Skeptic':   'replication',
  'Contribution Evaluator':'contribution',
  'Constructive Advocate': 'advocate',
  'Gap Finder':            'gap',
  'Hostile Reviewer':      'hostile',
  'Methods Auditor':       'methods2',
  'Related Work Scout':    'scout',
  'Supportive Mentor':     'mentor',
  'Moderator':             'moderator',
}

// 工具调用
export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'completed' | 'error'
  input?: Record<string, unknown>
  output?: string
}

// 消息内容块
export interface ThinkingBlock {
  type: 'thinking'
  content: string
  isStreaming?: boolean
}

export interface ToolUseBlock {
  type: 'tool_use'
  tool: ToolCall
}

export interface TextBlock {
  type: 'text'
  content: string
  isStreaming?: boolean
}

export type ContentBlock = ThinkingBlock | ToolUseBlock | TextBlock

// Agent 消息
export interface AgentMessage {
  id: string
  agentId: string
  round: number
  timestamp: Date
  blocks: ContentBlock[]
  isComplete: boolean
}

export interface SourceRef {
  label: string
  uri: string | null
  snippet: string | null
  agentId: string
  agentColor: string
  agentAvatar: string
  agentName: string
}

// 讨论会话
export interface DiscussionSession {
  id: string
  paperId: string
  paperTitle: string
  paperAbstract?: string
  status: 'waiting' | 'discussing' | 'concluded'
  messages: AgentMessage[]
  sourceRefs: SourceRef[]
  conclusion?: string
  startedAt: Date
  concludedAt?: Date
}
