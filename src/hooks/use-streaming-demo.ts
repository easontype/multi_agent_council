'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiscussionSession, AgentMessage, ContentBlock, DEFAULT_AGENTS as AGENTS } from '@/types/council'

// Demo 数据
const DEMO_DISCUSSION: { agentId: string; thinking: string; tools?: { name: string }[]; response: string }[] = [
  {
    agentId: 'methods',
    thinking: 'Let me analyze the methodology section of this paper. I need to check the experimental design, control groups, statistical methods, and whether the claims are properly supported by the evidence presented.',
    tools: [{ name: 'check_methodology' }],
    response: `The methodology presents several concerns:

1. **Sample Size**: The study uses only 847 samples for training, which may be insufficient for the claimed generalization capabilities.

2. **Evaluation Protocol**: Cross-validation is mentioned but details on fold sizes and stratification are missing.

3. **Baseline Comparisons**: Only two baseline methods are compared. More recent state-of-the-art approaches should be included.

I recommend requesting additional ablation studies to support the architectural choices.`,
  },
  {
    agentId: 'literature',
    thinking: 'I should check how well this paper situates itself within the existing literature. Are there missing citations? Are the comparisons fair?',
    tools: [{ name: 'search_semantic_scholar' }, { name: 'analyze_citations' }],
    response: `Literature coverage is adequate but has gaps:

**Missing key references:**
- Zhang et al. (2023) on similar architectural approaches
- The HELM benchmark should be referenced for evaluation standards

**Citation concerns:**
- Self-citation rate is 18%, which is within acceptable range
- Some citations are outdated (pre-2020) for rapidly evolving topics

The related work section would benefit from a more structured taxonomy of existing approaches.`,
  },
  {
    agentId: 'replication',
    thinking: 'Reproducibility is crucial. Let me check if the paper provides enough details for someone to replicate the experiments: code availability, hyperparameters, compute requirements, random seeds.',
    response: `**Reproducibility Assessment: Moderate**

✓ Code is promised to be released upon acceptance
✓ Hyperparameters are listed in Appendix A
✗ Random seeds not specified
✗ Compute requirements unclear (mentions "multiple GPUs")
✗ Data preprocessing steps lack detail

Recommendation: Request specific hardware specs and preprocessing code before acceptance.`,
  },
  {
    agentId: 'contribution',
    thinking: 'What is the actual novelty here? Is this incremental or does it represent a significant advance? I need to assess the delta over prior work.',
    tools: [{ name: 'search_related_work' }],
    response: `**Novelty Assessment:**

The main contribution—the proposed attention modification—is interesting but incremental. Similar ideas appear in:
- Wang et al. (2022): Different implementation, same intuition
- Li et al. (2023): Theoretical analysis of the same phenomenon

**What IS novel:**
- The specific combination of techniques
- Application to a new domain
- Empirical results showing 3.2% improvement

Verdict: Solid engineering contribution, but overclaims novelty in abstract.`,
  },
  {
    agentId: 'advocate',
    thinking: 'As the advocate, I need to highlight the strengths and defend the paper against overly harsh criticism. Every paper has merit that should be recognized.',
    response: `I want to highlight several **strengths** that deserve recognition:

1. **Clear writing**: The paper is well-organized and accessible to newcomers
2. **Practical impact**: The 3.2% improvement is meaningful for production systems
3. **Ablation studies**: Table 3 systematically justifies each component
4. **Negative results**: Appendix B honestly reports what didn't work

While colleagues raise valid concerns, the core contribution is solid and the paper advances our understanding. The methodological issues can be addressed in revision.

**My recommendation: Accept with minor revisions.**`,
  },
]

export function useStreamingDemo(paperTitle: string, paperAbstract?: string) {
  const [session, setSession] = useState<DiscussionSession>({
    id: 'demo-session',
    paperId: 'demo-paper',
    paperTitle,
    paperAbstract,
    status: 'waiting',
    agents: AGENTS,
    messages: [],
    sourceRefs: [],
    startedAt: new Date(),
  })

  const [isRunning, setIsRunning] = useState(false)

  const startDiscussion = useCallback(() => {
    if (isRunning) return

    setIsRunning(true)
    setSession((s) => ({ ...s, status: 'discussing', messages: [] }))

    let currentAgentIndex = 0
    let currentPhase: 'thinking' | 'tools' | 'response' = 'thinking'
    let charIndex = 0
    let toolIndex = 0

    const interval = setInterval(() => {
      if (currentAgentIndex >= DEMO_DISCUSSION.length) {
        clearInterval(interval)
        setSession((s) => ({ ...s, status: 'concluded', concludedAt: new Date() }))
        setIsRunning(false)
        return
      }

      const currentDemo = DEMO_DISCUSSION[currentAgentIndex]
      const agent = AGENTS.find((a) => a.id === currentDemo.agentId)!

      setSession((prev) => {
        const messages = [...prev.messages]
        const messageId = `msg-${currentAgentIndex}`
        let existingMessage = messages.find((m) => m.id === messageId)

        if (!existingMessage) {
          existingMessage = {
            id: messageId,
            agentId: currentDemo.agentId,
            round: 1,
            timestamp: new Date(),
            blocks: [],
            isComplete: false,
          }
          messages.push(existingMessage)
        }

        const msgIndex = messages.findIndex((m) => m.id === messageId)

        if (currentPhase === 'thinking') {
          const thinkingContent = currentDemo.thinking.slice(0, charIndex + 1)
          const blocks: ContentBlock[] = [
            { type: 'thinking', content: thinkingContent, isStreaming: charIndex < currentDemo.thinking.length - 1 },
          ]
          messages[msgIndex] = { ...existingMessage, blocks }

          charIndex++
          if (charIndex >= currentDemo.thinking.length) {
            charIndex = 0
            currentPhase = currentDemo.tools ? 'tools' : 'response'
          }
        } else if (currentPhase === 'tools') {
          const tools = currentDemo.tools || []
          const thinkingBlock: ContentBlock = { type: 'thinking', content: currentDemo.thinking }
          const toolBlocks: ContentBlock[] = tools.slice(0, toolIndex + 1).map((t, i) => ({
            type: 'tool_use' as const,
            tool: {
              id: `tool-${currentAgentIndex}-${i}`,
              name: t.name,
              status: i < toolIndex ? 'completed' as const : 'running' as const,
            },
          }))
          messages[msgIndex] = { ...existingMessage, blocks: [thinkingBlock, ...toolBlocks] }

          toolIndex++
          if (toolIndex > tools.length) {
            // Mark all tools as completed
            const completedToolBlocks: ContentBlock[] = tools.map((t, i) => ({
              type: 'tool_use' as const,
              tool: { id: `tool-${currentAgentIndex}-${i}`, name: t.name, status: 'completed' as const },
            }))
            messages[msgIndex] = { ...existingMessage, blocks: [thinkingBlock, ...completedToolBlocks] }
            toolIndex = 0
            currentPhase = 'response'
          }
        } else if (currentPhase === 'response') {
          const thinkingBlock: ContentBlock = { type: 'thinking', content: currentDemo.thinking }
          const toolBlocks: ContentBlock[] = (currentDemo.tools || []).map((t, i) => ({
            type: 'tool_use' as const,
            tool: { id: `tool-${currentAgentIndex}-${i}`, name: t.name, status: 'completed' as const },
          }))
          const responseContent = currentDemo.response.slice(0, charIndex + 3) // 3 chars at a time for speed
          const textBlock: ContentBlock = {
            type: 'text',
            content: responseContent,
            isStreaming: charIndex < currentDemo.response.length - 3,
          }
          messages[msgIndex] = { ...existingMessage, blocks: [thinkingBlock, ...toolBlocks, textBlock] }

          charIndex += 3
          if (charIndex >= currentDemo.response.length) {
            // Complete this message
            messages[msgIndex] = {
              ...existingMessage,
              blocks: [thinkingBlock, ...toolBlocks, { type: 'text', content: currentDemo.response }],
              isComplete: true,
            }
            charIndex = 0
            toolIndex = 0
            currentPhase = 'thinking'
            currentAgentIndex++
          }
        }

        return { ...prev, messages }
      })
    }, 20) // 20ms interval for smooth streaming

    return () => clearInterval(interval)
  }, [isRunning])

  return { session, isRunning, startDiscussion }
}
