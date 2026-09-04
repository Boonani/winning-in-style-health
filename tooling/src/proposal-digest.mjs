import { createHash } from 'node:crypto';

export const canonicalTagTuples = (cards, tagKey = 'tags') => cards
  .map((item) => ({
    board: item.board,
    index: Number(item.index),
    cardID: item.cardID,
    tags: [...(item[tagKey] ?? [])].sort(),
  }))
  .sort((left, right) => left.board.localeCompare(right.board) || left.index - right.index);

export const digestProposal = (cards) => createHash('sha256')
  .update(JSON.stringify(canonicalTagTuples(cards)))
  .digest('hex');
