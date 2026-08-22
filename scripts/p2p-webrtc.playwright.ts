import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function openPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto("about:blank");
  return page;
}

test("an eight-player room uses one Host-to-peer connection per peer", async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  try {
    const hostContext = await browser.newContext();
    contexts.push(hostContext);
    const host = await openPage(hostContext);
    await host.evaluate(() => Object.assign(globalThis, { testHostLinks: [] }));

    const peers: Page[] = [];
    for (let peerIndex = 0; peerIndex < 7; peerIndex += 1) {
      const peerContext = await browser.newContext();
      contexts.push(peerContext);
      const peer = await openPage(peerContext);
      peers.push(peer);

      const offer = await host.evaluate(async (index) => {
        const pc = new RTCPeerConnection();
        const reliable = pc.createDataChannel("ning-control-v1", { ordered: true });
        const realtime = pc.createDataChannel("ning-realtime-v1", { maxRetransmits: 0, ordered: false });
        const links = (globalThis as unknown as {
          testHostLinks: { pc: RTCPeerConnection; reliable: RTCDataChannel; realtime: RTCDataChannel }[];
        }).testHostLinks;
        links[index] = { pc, realtime, reliable };
        const description = await pc.createOffer();
        await pc.setLocalDescription(description);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") resolve();
          else pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") resolve(); };
        });
        return pc.localDescription?.toJSON();
      }, peerIndex);

      const answer = await peer.evaluate(async ({ index, remoteOffer }) => {
        const pc = new RTCPeerConnection();
        const messages: string[] = [];
        pc.ondatachannel = (event) => { event.channel.onmessage = (message) => messages.push(String(message.data)); };
        Object.assign(globalThis, { testMessages: messages, testPeerIndex: index, testPeerPc: pc });
        await pc.setRemoteDescription(remoteOffer!);
        const description = await pc.createAnswer();
        await pc.setLocalDescription(description);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") resolve();
          else pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") resolve(); };
        });
        return pc.localDescription?.toJSON();
      }, { index: peerIndex, remoteOffer: offer });

      await host.evaluate(async ({ index, remoteAnswer }) => {
        const link = (globalThis as unknown as {
          testHostLinks: { pc: RTCPeerConnection; reliable: RTCDataChannel; realtime: RTCDataChannel }[];
        }).testHostLinks[index]!;
        await link.pc.setRemoteDescription(remoteAnswer!);
        await Promise.all([link.reliable, link.realtime].map((channel) => new Promise<void>((resolve) => {
          if (channel.readyState === "open") resolve();
          else channel.onopen = () => resolve();
        })));
        link.reliable.send(`control-ready-${index}`);
        link.realtime.send(JSON.stringify({
          enemyIds: ["thrall:w1:e0:a1", "thrall:w1:e1:b2", "thrall:w1:e2:c3"],
          layoutHash: "fnv1a32:p6-greybox",
          messageType: "game.snapshot",
          revision: 42,
          roomId: "eight-player-p6",
          topologyEpoch: 7,
          wave: { enemiesRemaining: 3, phase: "combat", revision: 5, waveNumber: 1 },
        }));
      }, { index: peerIndex, remoteAnswer: answer });
    }

    const peerWorldViews: unknown[] = [];
    for (let peerIndex = 0; peerIndex < peers.length; peerIndex += 1) {
      const peer = peers[peerIndex]!;
      await expect.poll(() => peer.evaluate(() => (
        globalThis as unknown as { testMessages: string[] }
      ).testMessages.length)).toBe(2);
      const messages = await peer.evaluate(() => (
        globalThis as unknown as { testMessages: string[] }
      ).testMessages.slice());
      expect(messages).toContain(`control-ready-${peerIndex}`);
      const snapshotMessage = messages.find((message) => message.startsWith("{"));
      expect(snapshotMessage).toBeDefined();
      peerWorldViews.push(JSON.parse(snapshotMessage!));
      await expect(peer.evaluate(() => (
        globalThis as unknown as { testPeerPc: RTCPeerConnection }
      ).testPeerPc.connectionState)).resolves.toBe("connected");
    }

    expect(peerWorldViews).toHaveLength(7);
    expect(peerWorldViews.every((world) => JSON.stringify(world) === JSON.stringify(peerWorldViews[0])))
      .toBe(true);
    expect(peerWorldViews[0]).toMatchObject({
      enemyIds: ["thrall:w1:e0:a1", "thrall:w1:e1:b2", "thrall:w1:e2:c3"],
      messageType: "game.snapshot",
      topologyEpoch: 7,
      wave: { enemiesRemaining: 3, phase: "combat", waveNumber: 1 },
    });

    expect(await host.evaluate(() => (
      globalThis as unknown as { testHostLinks: unknown[] }
    ).testHostLinks.length)).toBe(7);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
