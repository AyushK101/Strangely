import assert from "node:assert/strict";
import test from "node:test";

import { Matchmaker } from "../src/matchmaking/matchmaker.js";

test("matchmaker enforces idempotent queue transitions", () => {
  const matchmaker = new Matchmaker();

  assert.equal(matchmaker.enqueue("peer-a"), null);
  assert.equal(matchmaker.enqueue("peer-a"), null);
  assert.equal(matchmaker.has("peer-a"), true);

  matchmaker.drop("peer-a");
  assert.equal(matchmaker.has("peer-a"), false);

  assert.equal(matchmaker.enqueue("peer-b"), null);
  const pair = matchmaker.enqueue("peer-c");

  assert.ok(pair);
  assert.equal(pair?.first.peerId, "peer-b");
  assert.equal(pair?.second.peerId, "peer-c");
});

test("matchmaker purges stale tickets in FIFO order", () => {
  const matchmaker = new Matchmaker();

  matchmaker.enqueue("peer-a", 0, 10);

  const staleTickets = matchmaker.purgeOlderThan(45, 20);

  assert.deepEqual(
    staleTickets.map((ticket) => ticket.peerId),
    ["peer-a"],
  );
  assert.equal(matchmaker.has("peer-a"), false);
  assert.equal(matchmaker.has("peer-b"), false);
});
