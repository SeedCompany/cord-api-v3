import { cmpBy, groupBy, setOf } from '@seedcompany/common';
import { type Simplify } from 'type-fest';

class PollState<Choice, Voter> {
  closed = false;
  voters = new Set<Voter>();
  votes = new Map<Voter, Choice>();
  vetoers = new Set<Voter>();
}

class VoteTally<Choice, Voter> {
  protected readonly state: PollState<Choice, Voter>;
  protected readonly tallies: ReadonlyArray<
    Readonly<{
      choice: Choice;
      count: number;
      voters: ReadonlySet<Voter>;
    }>
  >;

  constructor(state: PollState<Choice, Voter>) {
    this.state = state;
    this.tallies = groupBy(state.votes, ([, vote]) => vote)
      .map((entries) => {
        const voters = setOf(entries.map(([voter]) => voter));
        return {
          choice: entries[0][1],
          voters,
          count: voters.size,
        };
      })
      .sort(cmpBy([(c) => c.count, 'desc']));
  }

  protected get totalVotes() {
    return this.state.votes.size;
  }

  protected get vetoed() {
    return this.state.vetoers.size > 0;
  }

  /** Returns the largest minority vote (could be majority too), if there was one */
  get plurality() {
    if (this.vetoed) {
      return undefined;
    }
    const [highest, second] = this.tallies;
    if (!highest) {
      return undefined;
    }
    return highest.count > (second?.count ?? 0) ? highest : undefined;
  }

  /** Returns the majority vote (>50%) if there was one */
  get majority() {
    if (this.vetoed) {
      return undefined;
    }
    const [first] = this.tallies;
    if (!first) {
      return undefined;
    }
    return first.count > this.totalVotes / 2 ? first : undefined;
  }

  /** Returns the unanimous vote if there was one */
  get unanimous() {
    if (this.vetoed) {
      return undefined;
    }
    const all = this.tallies;
    return all.length === 1 ? all[0]! : undefined;
  }
}

export type WinnerStrategy = keyof Simplify<VoteTally<any, any>>;

export class PollResult<Choice, Voter = unknown> extends VoteTally<
  Choice,
  Voter
> {
  constructor(
    state: PollState<Choice, Voter>,
    readonly winnerStrategy: WinnerStrategy,
  ) {
    super(state);
  }

  /** Returns the winning choice (if there is one), based on the chosen strategy */
  get winner() {
    return this.winnerTally?.choice;
  }

  /** Returns the winner tally (if there is one), based on the chosen strategy */
  get winnerTally() {
    return this[this.winnerStrategy];
  }

  /** Returns true if there were any votes */
  get anyVotes() {
    return this.totalVotes > 0;
  }

  /** Returns true if there were no votes */
  get noVotes() {
    return this.totalVotes === 0;
  }

  get totalVotes() {
    return super.totalVotes;
  }

  get vetoed() {
    return super.vetoed;
  }

  get vetoers(): ReadonlySet<Voter> {
    return this.state.vetoers;
  }

  /** Returns if there was a tie in the tally of the top choices */
  get tie() {
    const [highest, second] = this.tallies;
    return highest && second ? highest.count === second.count : false;
  }

  /** Returns all tallies sorted by the highest choice first (ties are unaccounted for) */
  get allTallies() {
    return this.tallies;
  }
}

/**
 * A collection of ballots.
 */
export class BallotBox<Choice, Voter = unknown> {
  /** @internal */
  constructor(protected readonly state: PollState<Choice, Voter>) {}

  get isClosed() {
    return this.state.closed;
  }

  /**
   * Register a new voter.
   * Voters can only be registered once.
   */
  registerVoter(voter: Voter) {
    if (this.state.closed) {
      throw new Error('Poll is closed');
    }
    if (this.state.voters.has(voter)) {
      throw new Error('Voter already exists');
    }
    this.state.voters.add(voter);
    return new Ballot(voter, this.state);
  }

  /**
   * Cast a vote as a certain voter.
   *
   * This can only be done once, per voter, even if the voter identity is the same.
   * If you need to redo a vote, you can use {@link registerVoter} to hold the ballot handle,
   * and call its {@link vote} multiple times (as long as the {@link Poll} is not closed).
   *
   * @see Ballot.vote
   */
  vote(voter: Voter, choice: Choice) {
    this.registerVoter(voter).vote(choice);
  }

  /**
   * Veto the poll as a certain voter.
   *
   * This can only be done once, per voter, even if the voter identity is the same.
   *
   * @see Ballot.veto
   */
  veto(voter: Voter) {
    this.registerVoter(voter).veto();
  }
}

/**
 * @example
 * const poll = new Poll();
 *
 * poll.vote('Bilbo', true);
 * poll.vote('Frodo', true);
 * poll.vote('Samwise', false);
 *
 * const result = poll.close();
 * result.winner.choice; // true
 * result.winner.voters; // {Bilbo, Frodo}
 */
export class Poll<Choice, Voter = unknown> extends BallotBox<Choice, Voter> {
  /**
   * Configures a poll type, returning a creation handle, and pre-configured types
   * for the polling system.
   *
   * @template Choice - The type representing the choices available in the poll.
   * @template Voter - The type representing the voter, defaults to unknown if not specified.
   */
  static configured<Choice, Voter = unknown>() {
    return {
      create: () => new Poll<Choice, Voter>(),
    } as unknown as {
      create: () => Poll<Choice, Voter>;
      $Poll: Poll<Choice, Voter>;
      $BallotBox: BallotBox<Choice, Voter>;
      $Ballot: Ballot<Choice, Voter>;
      $Result: PollResult<Choice, Voter>;
    };
  }

  constructor() {
    super(new PollState<Choice, Voter>());
  }

  readonly ballotBox = new BallotBox(this.state);

  get voters(): ReadonlySet<Voter> {
    return this.state.voters;
  }

  /**
   * Close the poll and return the result.
   * This can only be done once.
   */
  close(winnerStrategy: WinnerStrategy = 'plurality') {
    if (this.state.closed) {
      throw new Error('Poll is already closed');
    }
    this.state.closed = true;
    const result = new PollResult(this.state, winnerStrategy);
    return result;
  }
}

/**
 * A handle for a certain poll voter to cast their vote.
 */
export class Ballot<Choice, Voter = unknown> {
  /** @internal */
  constructor(
    readonly voter: Voter,
    protected readonly state: PollState<Choice, Voter>,
  ) {}

  /** Cast a vote. */
  vote(choice: Choice) {
    if (this.state.closed) {
      throw new Error('Poll is closed');
    }
    this.state.votes.set(this.voter, choice);
  }

  /**
   * Veto the poll all together.
   * Multiple vetoes are allowed and are functionally the same.
   * Consider using this instead of throwing an exception, for when you want to
   * "cancel" the poll / override all other votes.
   * Exceptions are for unexpected errors, where this veto would be a logical
   * expectation, so throwing is not the best way to handle it.
   * This could be enhanced in the future to allow a reason for the veto.
   */
  veto() {
    if (this.state.closed) {
      throw new Error('Poll is closed');
    }
    this.state.vetoers.add(this.voter);
  }
}
