const COMPLETE_TOOL_CALL_RE = /\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g
const COMPLETE_TOOL_RESULT_RE = /\[TOOL_RESULT[^\]]*\][\s\S]*?\[\/TOOL_RESULT\]/g

const DANGLING_MARKERS = [
  '[TOOL_CALL',
  '[/TOOL_CALL',
  '[TOOL_RESULT',
  '[/TOOL_RESULT',
]

const TAG_PREFIX_SOURCES = [
  '[TOOL_CALL]',
  '[/TOOL_CALL]',
  '[TOOL_RESULT',
  '[/TOOL_RESULT]',
]

function trimDanglingMarkerBlock(text: string): string {
  let cutIndex = -1
  for (const marker of DANGLING_MARKERS) {
    const idx = text.lastIndexOf(marker)
    if (idx > cutIndex) cutIndex = idx
  }
  return cutIndex === -1 ? text : text.slice(0, cutIndex)
}

function trimTrailingPartialTag(text: string): string {
  const minPrefixLength = 1
  let longestMatch = 0

  for (const tag of TAG_PREFIX_SOURCES) {
    for (let len = Math.min(tag.length - 1, text.length); len >= minPrefixLength; len -= 1) {
      const suffix = text.slice(-len)
      if (tag.startsWith(suffix)) {
        longestMatch = Math.max(longestMatch, len)
        break
      }
    }
  }

  return longestMatch > 0 ? text.slice(0, -longestMatch) : text
}

export function sanitizeToolTextForDisplay(text: string): string {
  const withoutCompleteBlocks = text
    .replace(COMPLETE_TOOL_CALL_RE, '')
    .replace(COMPLETE_TOOL_RESULT_RE, '')

  const withoutDanglingBlocks = trimDanglingMarkerBlock(withoutCompleteBlocks)
  return trimTrailingPartialTag(withoutDanglingBlocks)
}
