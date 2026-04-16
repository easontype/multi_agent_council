// Agent 定义
export interface Agent {
  id: string
  name: string
  role: string
  color: string
  avatar: string // 首字母或 emoji
}

// 5 个 Agent 配置
export const AGENTS: Agent[] = [
  { id: 'methods', name: 'Dr. Methods', role: 'Methodology Critic', color: '#6366f1', avatar: 'M' },
  { id: 'literature', name: 'Prof. Literature', role: 'Literature Expert', color: '#8b5cf6', avatar: 'L' },
  { id: 'replication', name: 'Dr. Replication', role: 'Reproducibility Checker', color: '#06b6d4', avatar: 'R' },
  { id: 'contribution', name: 'Prof. Contribution', role: 'Novelty Assessor', color: '#f59e0b', avatar: 'C' },
  { id: 'advocate', name: 'Dr. Advocate', role: 'Paper Advocate', color: '#10b981', avatar: 'A' },
]

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
  timestamp: Date
  blocks: ContentBlock[]
  isComplete: boolean
}

// 讨论会话
export interface DiscussionSession {
  id: string
  paperId: string
  paperTitle: string
  paperAbstract?: string
  status: 'waiting' | 'discussing' | 'concluded'
  messages: AgentMessage[]
  startedAt: Date
  concludedAt?: Date
}
