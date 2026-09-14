export class ResourceNotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(`${resource} not found`);
    this.name = "ResourceNotFoundError";
  }
}
