class EqualityError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(`Expected '${expected}' but got '${actual}'`);
    this.name = 'EqualityError';
  }
}

export {EqualityError};
