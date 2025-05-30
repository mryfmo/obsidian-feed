// Custom error class for network-related errors
export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
