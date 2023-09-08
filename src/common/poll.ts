import { setOf } from '@seedcompany/common';

export class PollResults<T> {
  constructor(protected readonly data: PollData<T>) {}

  /** Returns true if there were any votes */
  get anyVotes() {
    return this.numberOfVotes > 0;
  }

  /** Returns true if there were no votes */
  get noVotes() {
    return this.numberOfVotes === 0;
  }

  get numberOfVotes() {
    return [...this.data.votes.values()].reduce((total, cur) => total + cur, 0);
  }

  get vetoed() {
    return this.data.vetoed;
  }

  /** Returns if there was a tie for the highest votes */
  get tie() {
    const [highest, second] = this.sorted;
    return highest && second ? highest[1] === second[1] : false;
  }

  /** Returns the largest minority vote (could be majority too), if there was one */
  get plurality() {
    const [highest, second] = this.sorted;
    if (!highest) {
      return undefined;
    }
    return highest[1] > (second?.[1] ?? 0) ? highest[0] : undefined;
  }

  /** Returns the majority vote (>50%), if there was one */
  get majority() {
    const [first] = this.sorted;
    if (!first) {
      return undefined;
    }
    return first[1] > this.numberOfVotes / 2 ? first[0] : undefined;
  }

  /** Returns the unanimous vote, if there was one */
  get unanimous() {
    const all = this.sorted;
    return all.length === 1 ? all[0][0] : undefined;
  }

  /** Returns all votes sorted by most voted first (ties are unaccounted for) */
  get allVotes() {
    return setOf(this.sorted.map(([vote]) => vote));
  }

  private get sorted() {
    return [...this.data.votes].sort((a, b) => b[1] - a[1]);
  }
}

/**
 * @example
 * const poll = new Poll();
 *
 * poll.noVotes; // true
 * poll.vote(true);
 * poll.unanimous; // true
 * poll.anyVotes; // true
 *
 * poll.vote(false);
 * poll.unanimous; // undefined
 * poll.tie; // true
 * poll.majority; // undefined
 * poll.plurality; // undefined
 *
 * poll.vote(true);
 * poll.majority; // true
 * poll.plurality; // true
 */
export class Poll<T = boolean> extends PollResults<T> implements PollVoter<T> {
  // Get a view of this poll, with results hidden.
  readonly voter: PollVoter<T> = this;
  // Get a readonly view of this poll's results.
  readonly results: PollResults<T> = this;

  constructor() {
    super(new PollData<T>());
  }

  vote(vote: T) {
    this.data.votes.set(vote, (this.data.votes.get(vote) ?? 0) + 1);
  }

  veto() {
    this.data.vetoed = true;
  }
}

/**
 * The mutations available for a poll.
 */
export abstract class PollVoter<T> {
  /** Cast a vote. */
  abstract vote(vote: T): void;

  /**
   * Veto the poll all together.
   * Multiple vetoes are allowed and are functionally the same.
   * Consider using this instead of throwing an exception, for when you want to
   * "cancel" the poll / override all other votes.
   * Exceptions are for unexpected errors, where this veto would be a logical
   * expectation, so throwing is not the best way to handle it.
   * This could be enhanced in future to allow a reason for the veto.
   */
  abstract veto(): void;
}

class PollData<T> {
  votes = new Map<T, number>();
  vetoed = false;
}
