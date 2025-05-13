// UndoAction interface remains, as it's a shared type definition
export interface UndoAction {
  itemId?: string; // Optional for single item actions
  feedName: string; // Feed context is important
  action: "read" | "unread" | "deleted" | "undeleted" | "markAllRead";
  previousState?: string; // The state before the action
  previousStates?: Array<{ itemId: string, readState: string }>; // For markAllRead, stores original read states
}
