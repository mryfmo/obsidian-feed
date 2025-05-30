// === Custom Error Classes ===
export class PluginOperationError extends Error {
  public readonly userFacingMessage: string;

  public readonly isOperational: boolean;

  constructor(internalMessage: string, userFacingMessage?: string, isOperational: boolean = true) {
    super(internalMessage);
    this.name = this.constructor.name;
    this.userFacingMessage = userFacingMessage || internalMessage;
    this.isOperational = isOperational;
  }
}

export class FeedValidationError extends PluginOperationError {}
export class FeedFetchError extends PluginOperationError {}
export class FeedParseError extends PluginOperationError {}
export class FeedStorageError extends PluginOperationError {}
