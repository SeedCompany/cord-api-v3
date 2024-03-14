export class Position {
  static EMPTY = new Position(0, 0);

  static full(text: string) {
    return new Position(0, text.length);
  }

  static within(needle: string, haystack: string) {
    const start = haystack.indexOf(needle);
    return new Position(start, start + needle.length);
  }

  constructor(readonly start: number, readonly end: number) {}

  shift(by: Pick<Position, 'start'>) {
    return new Position(this.start + by.start, this.end + by.start);
  }

  sliceOf(text: string) {
    return text.slice(this.start, this.end);
  }
}
