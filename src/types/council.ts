export interface Agent {
  id: string
  name: string
  role: string
  seatRole: string
  color: string
  avatar: string
}

export const DEFAULT_AGENTS: Agent[] = [
  { id: 'methods', name: 'Methods Critic', role: 'Methodology', seatRole: 'Methods Critic', color: '#43506b', avatar: 'M' },
  { id: 'literature', name: 'Literature Auditor', role: 'Related Work', seatRole: 'Literature Auditor', color: '#65505f', avatar: 'L' },
  { id: 'replication', name: 'Replication Skeptic', role: 'Reproducibility', seatRole: 'Replication Skeptic', color: '#466671', avatar: 'R' },
  { id: 'contribution', name: 'Contribution Evaluator', role: 'Novelty', seatRole: 'Contribution Evaluator', color: '#8a5f3b', avatar: 'C' },
  { id: 'advocate', name: 'Constructive Advocate', role: 'Best Case', seatRole: 'Constructive Advocate', color: '#59674b', avatar: 'A' },
  { id: 'moderator', name: 'Moderator', role: 'Synthesis', seatRole: 'Moderator', color: '#6b7280', avatar: 'M' },
]

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'completed' | 'error'
  input?: Record<string, unknown>
  output?: string
}

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

export interface SessionAlert {
  id: string
  level: 'info' | 'warning'
  message: string
}

export interface DiscussionSession {
  id: string
  paperId: string
  paperTitle: string
  paperAbstract?: string
  status: 'waiting' | 'discussing' | 'concluded'
  agents: Agent[]
  messages: AgentMessage[]
  sourceRefs: SourceRef[]
  conclusion?: string
  currentRound?: number
  divergenceLevel?: 'none' | 'low' | 'moderate' | 'high' | null
  round2SkippedReason?: string
  alerts?: SessionAlert[]
  startedAt: Date
  concludedAt?: Date
}
