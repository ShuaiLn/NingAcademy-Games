import { createInitialGameState } from "@ningacademy/game-core";
import {
  PROTOCOL_VERSION,
  createAcceptedCommandAck,
  type CommandEnvelope,
  type EventEnvelope,
} from "@ningacademy/protocol";
import { describe, expect, it } from "vitest";

import {
  LocalAuthority,
  RemoteAuthority,
  type AuthorityDispatchResult,
  type RemoteAuthorityTransport,
} from "../src/index.js";

function initialState() {
  return createInitialGameState({
    roomId: "authority-room",
    rulesetVersion: "test-v1",
    seed: 123,
    nowMs: 100,
  });
}

describe("LocalAuthority", () => {
  it("binds lifecycle commands to its authenticated local identity", async () => {
    const authority = new LocalAuthority({
      initialState: initialState(),
      authenticatedUserId: "alice",
      clock: () => 500,
      commandIdFactory: () => "join-command",
    });
    const observedEvents: EventEnvelope[] = [];
    const listener = (event: EventEnvelope) => {
      observedEvents.push(event);
    };
    authority.subscribe(listener);

    const result = await authority.dispatch({ type: "player.join", displayName: "Alice" });

    expect(result.ack).toMatchObject({ accepted: true, revision: 1 });
    expect(authority.getSnapshot().players.alice?.displayName).toBe("Alice");
    expect(observedEvents[0]).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      payload: { type: "player.joined", playerId: "alice" },
    });
  });

  it("returns a versioned rejection without changing state on revision conflict", async () => {
    const authority = new LocalAuthority({
      initialState: initialState(),
      authenticatedUserId: "alice",
      clock: () => 500,
    });

    const result = await authority.dispatch(
      { type: "player.join", displayName: "Alice" },
      { expectedRevision: 99 },
    );

    expect(result.ack).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      accepted: false,
      revision: 0,
      error: { code: "REVISION_CONFLICT" },
    });
    expect(authority.getSnapshot().revision).toBe(0);
  });
});

describe("RemoteAuthority", () => {
  it("sends no client-controlled identity field", async () => {
    let sentEnvelope: CommandEnvelope | undefined;
    const snapshot = initialState();
    const transport: RemoteAuthorityTransport = {
      getSnapshot: () => snapshot,
      send: (envelope): Promise<AuthorityDispatchResult> => {
        sentEnvelope = envelope;
        return Promise.resolve({
          ack: createAcceptedCommandAck(envelope, 1, false),
          events: [],
        });
      },
      subscribe: () => () => undefined,
      close: () => undefined,
    };
    const authority = new RemoteAuthority({
      roomId: snapshot.roomId,
      transport,
      clock: () => 700,
      commandIdFactory: () => "remote-command",
    });

    await authority.dispatch({ type: "player.join", displayName: "Alice" });

    expect(sentEnvelope).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      messageType: "game.command",
      roomId: snapshot.roomId,
      commandId: "remote-command",
      sentAtMs: 700,
      payload: { type: "player.join", displayName: "Alice" },
    });
    expect(sentEnvelope).not.toHaveProperty("userId");
    expect(sentEnvelope).not.toHaveProperty("actor");
  });
});
