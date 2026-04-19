import { create } from 'zustand'

interface ReviewSetupState {
  /** ID of the agent currently being edited in AgentDetailModal, or null if closed */
  editingId: string | null
  /** Whether the TeamBuilderModal is open */
  builderOpen: boolean

  setEditingId: (id: string | null) => void
  setBuilderOpen: (open: boolean) => void
}

export const useReviewSetupStore = create<ReviewSetupState>()((set) => ({
  editingId: null,
  builderOpen: false,

  setEditingId: (id) => set({ editingId: id }),
  setBuilderOpen: (open) => set({ builderOpen: open }),
}))
