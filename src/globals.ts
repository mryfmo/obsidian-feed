// UndoAction interface remains, as it's a shared type definition
export interface UndoAction {
  itemId?: string; // Optional for single item actions
  feedName?: string; // Optional to support mixed view where feed context may not be available
  action: 'read' | 'unread' | 'deleted' | 'undeleted' | 'markAllRead';
  previousState?: string; // The state before the action
  previousStates?: Array<{ itemId: string; readState: string; feedName?: string }>; // For markAllRead and mixed view, stores feed context per item
}
