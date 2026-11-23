// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// tests/step5f-external/contracts.ts
var TIMING_NAMES = /* @__PURE__ */ new Set([
  "bot.prepare",
  "bot.policy",
  "bot.publicMemory",
  "persistence.commit",
  "persistence.installPacked.prepare",
  "persistence.installPacked.transaction",
  "persistence.installRecovery.prepare",
  "persistence.installRecovery.transaction",
  "persistence.load",
  "persistence.prepareRecovery",
  "persistence.prepareSegments",
  "persistence.transaction",
  "persistence.packHand",
  "recovery.archiveInventory",
  "recovery.canonicalArchiveAudit",
  "recovery.explicitFullHistory",
  "recovery.fastRestore",
  "recovery.financialArchive",
  "recovery.residentArchive",
  "recovery.configurationSemantics",
  "recovery.financialSemantics",
  "recovery.handChain",
  "recovery.handSemantics",
  "recovery.ledgerChain",
  "recovery.freezeTransport",
  "recovery.unpackHand",
  "recovery.read.canonicalFallback",
  "recovery.freeze",
  "recovery.prepareCheckpoint",
  "recovery.verifyFinancialCheckpoint",
  "snapshot.draft",
  "integrity.fullAudit",
  "integrity.incremental",
  "statistics.aggregate",
  "statistics.prewarm",
  "ui.historyProjection",
  "ui.render",
  "ui.sync",
  ...["ledger", "hands", "closedSessions", "importedHands"].flatMap((name) => [`recovery.read.${name}`, `recovery.segmentHash.${name}`])
]);
function projectTimingSample(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input), allowed = /* @__PURE__ */ new Set(["version", "name", "milliseconds", "startTime", "endTime", "sequence"]);
  if (Object.keys(descriptors).some((key) => !allowed.has(key) || !("value" in descriptors[key]))) return null;
  const value = (key) => descriptors[key]?.value;
  if (value("version") !== 1 || typeof value("name") !== "string" || !TIMING_NAMES.has(value("name")) || !Number.isFinite(value("milliseconds")) || value("milliseconds") < 0) return null;
  const result = { version: 1, name: value("name"), milliseconds: value("milliseconds") };
  for (const key of ["startTime", "endTime", "sequence"]) {
    const entry = value(key);
    if (entry !== void 0) {
      if (!Number.isFinite(entry) || entry < 0) return null;
      result[key] = entry;
    }
  }
  if (result.startTime !== void 0 && result.endTime !== void 0 && result.endTime < result.startTime) return null;
  return result;
}
var BoundedSamples = class {
  constructor(limit = 5e3) {
    this.limit = limit;
    if (!Number.isInteger(limit) || limit < 1) throw Error("Positive sample limit required");
  }
  retained = [];
  count = 0;
  sum = 0;
  minimum = Infinity;
  maximum = 0;
  add(value) {
    if (!Number.isFinite(value) || value < 0) throw Error("Finite nonnegative duration required");
    this.count++;
    this.sum += value;
    this.minimum = Math.min(this.minimum, value);
    this.maximum = Math.max(this.maximum, value);
    if (this.retained.length < this.limit) this.retained.push(value);
  }
  report() {
    const sorted = this.retained.slice().sort((a, b) => a - b), dropped = this.count - sorted.length, q = (p) => !this.count || dropped ? null : sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
    return { count: this.count, retained: sorted.length, dropped, p50: q(0.5), p95: q(0.95), p99: q(0.99), maximum: this.count ? this.maximum : null, minimum: this.count ? this.minimum : null, mean: this.count ? this.sum / this.count : null, quantileScope: dropped ? "NOT_MEASURED: raw retention cap reached; maximum/count/mean still include every observed event." : "All observed samples; nearest-rank quantiles." };
  }
};

// tests/browser/step5f-external-observer.ts
var MAX_RECORDS = 2e3;
var MAX_INTERACTIONS = 500;
function readPublicDisplay(root) {
  const text = (selector, max = 600) => root.querySelector(selector)?.textContent?.trim().slice(0, max) ?? "";
  return { view: root.querySelector("#setup-form") ? "setup" : root.querySelector('[data-testid="session-manager"]') ? "session" : root.querySelector("#export-history") ? "history" : root.querySelector("#adjust-bankroll") ? "cashier" : root.querySelector('[data-testid="stats-profit"]') ? "results" : root.querySelector('[data-testid="poker-table"]') ? "table" : "loading", street: text('[data-testid="street"]', 30), pot: text('[data-testid="pot"]', 60), wallet: text('[data-testid="wallet-balance"]', 60), tableStack: text('[data-testid="table-stack"]', 60), sessionProfit: text('[data-testid="session-profit"]', 60), handCount: text('[data-testid="hand-count"]', 30), saveStatus: text('[data-testid="save-status"]', 150), provenance: text('[data-testid="session-provenance"]', 500), announcement: text("#table-announcement"), error: text(".error-banner,.storage-banner.error,.storage-banner.readonly", 500) };
}
var signature = (value) => JSON.stringify({ ...value, saveStatus: "" });
function installExternalObserver(root) {
  const startedAt = (/* @__PURE__ */ new Date()).toISOString(), started = performance.now(), timings = /* @__PURE__ */ new Map(), timingTrace = [], interactions = [], longTasks = [], eventTiming = [], memory = [];
  let ignoredTimingEvents = 0, droppedTimingTrace = 0, droppedInteractions = 0, droppedLongTasks = 0, droppedEventTiming = 0, memorySamples = 0, closed = false, frame = 0, pending = null, firstPublicUI = null, savedIndicator = null;
  const recordMemory = () => {
    memorySamples++;
    const current = performance.memory;
    memory.push({ at: performance.now(), usedJSHeapSize: current?.usedJSHeapSize ?? null, totalJSHeapSize: current?.totalJSHeapSize ?? null, jsHeapSizeLimit: current?.jsHeapSizeLimit ?? null });
    if (memory.length > 200) memory.shift();
  };
  const timing = (event) => {
    const sample = projectTimingSample(event.detail);
    if (!sample) {
      ignoredTimingEvents++;
      return;
    }
    const bucket = timings.get(sample.name) ?? new BoundedSamples();
    bucket.add(sample.milliseconds);
    timings.set(sample.name, bucket);
    if (timingTrace.length < MAX_RECORDS) timingTrace.push(sample);
    else droppedTimingTrace++;
  };
  window.addEventListener("ai-texas-performance-sample", timing);
  const financialIds = /* @__PURE__ */ new Set(["fold", "call", "raise", "jam", "next-hand", "end-complete", "end-fold", "end-finish", "adjust-bankroll", "topup-submit", "start-game", "start-session", "new-session"]);
  const click = (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target.closest('button,input[type="submit"],a,summary');
    if (!target || !root.contains(target)) return;
    const action = target.id || (["data-view", "data-action", "data-size", "data-replay"].find((k) => target.hasAttribute(k)) ?? target.tagName);
    if (interactions.length >= MAX_INTERACTIONS) {
      droppedInteractions++;
      return;
    }
    if (pending) {
      pending.outcome = "NO_CHANGE_OBSERVED_BEFORE_NEXT_INPUT";
      pending = null;
    }
    const proposal = root.querySelector("#raise-to")?.value ?? null;
    const row = { number: interactions.length + 1, at: performance.now(), action: action.slice(0, 100), trusted: true, inputMethod: event.detail === 0 ? "keyboard-or-assistive-click" : "pointer-click", before: readPublicDisplay(root), raiseProposal: financialIds.has(target.id) ? proposal : null, outcome: "PENDING", visibleAfterMs: null, nextFrameAfterMs: null, after: null, focusAfter: null };
    interactions.push(row);
    pending = row;
  };
  root.addEventListener("click", click, true);
  const observeDisplay = () => {
    frame = 0;
    if (closed) return;
    const state = readPublicDisplay(root), now = performance.now();
    if (firstPublicUI === null && state.view !== "loading") firstPublicUI = now - started;
    if (savedIndicator === null && state.saveStatus.startsWith("Saved on this device")) savedIndicator = now - started;
    if (!pending || signature(state) === signature(pending.before)) return;
    if (state.saveStatus && !state.saveStatus.startsWith("Saved on this device") && !state.error) return;
    const row = pending;
    pending = null;
    row.visibleAfterMs = now - row.at;
    row.after = state;
    row.outcome = state.error ? "UI_ERROR_OBSERVED" : "VISIBLE_CHANGE_OBSERVED";
    row.focusAfter = document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.tagName : null;
    requestAnimationFrame(() => {
      row.nextFrameAfterMs = performance.now() - row.at;
    });
  };
  const observer = new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(observeDisplay);
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "class"] });
  const supported = typeof PerformanceObserver === "undefined" ? [] : PerformanceObserver.supportedEntryTypes;
  const performanceObservers = [];
  if (supported.includes("longtask")) {
    const observer2 = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime + entry.duration < started) continue;
        if (longTasks.length < MAX_RECORDS) longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        else droppedLongTasks++;
      }
    });
    observer2.observe({ type: "longtask", buffered: true });
    performanceObservers.push(observer2);
  }
  if (supported.includes("event")) {
    const observer2 = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime + entry.duration < started) continue;
        const event = entry;
        if (eventTiming.length < MAX_RECORDS) eventTiming.push({ name: event.name, startTime: event.startTime, duration: event.duration, processingStart: event.processingStart ?? 0, processingEnd: event.processingEnd ?? 0, interactionId: event.interactionId ?? null });
        else droppedEventTiming++;
      }
    });
    try {
      observer2.observe({ type: "event", buffered: true, durationThreshold: 16 });
      performanceObservers.push(observer2);
    } catch {
      observer2.disconnect();
    }
  }
  recordMemory();
  return {
    sampleMemory: recordMemory,
    capture: () => {
      recordMemory();
      return { format: "step5f-manual-browser-observations", version: 1, status: "OBSERVED", startedAt, capturedAt: (/* @__PURE__ */ new Date()).toISOString(), browser: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, measurementStartTime: started, elapsedMs: performance.now() - started, firstPublicUIDOMMs: firstPublicUI, savedIndicatorDOMMs: savedIndicator, performanceOptIn: new URLSearchParams(location.search).get("measurePerformance") === "1", timings: Object.fromEntries([...timings].map(([name, samples]) => [name, samples.report()])), timingTrace, droppedTimingTrace, ignoredTimingEvents, interactions, droppedInteractions, longTasks, droppedLongTasks, eventTiming, droppedEventTiming, memory, droppedMemorySamples: memorySamples - memory.length, publicDisplay: readPublicDisplay(root), coverage: { botCompute: timings.has("bot.policy") ? "OBSERVED timing-only bridge" : "NOT_MEASURED", fullPreparation: timings.has("bot.prepare") ? "OBSERVED timing-only bridge" : "NOT_MEASURED", trustedInputToVisibleConfirmation: "DOM confirmation proxy; not durable commit, physical paint or INP", longTasks: supported.includes("longtask") ? "SUPPORTED; record count is actual" : "NOT_MEASURED: browser API unavailable", eventTiming: supported.includes("event") ? "SUPPORTED; raw observed entries, not a complete INP calculation" : "NOT_MEASURED: browser API unavailable", heap: memory.some((row) => row.usedJSHeapSize !== null) ? "Coarse performance.memory; no forced GC; not retained-object attribution" : "NOT_MEASURED: browser heap API unavailable", screenReaderSpeech: "NOT_EXECUTED: actual spoken output must be recorded by the human tester", physicalDevice: "NOT_VERIFIED_BY_AUTOMATION", newUserStudy: "NOT_EXECUTED: separate observed participant records required" }, privacy: { controllerAccess: false, engineStateAccess: false, databaseReads: false, privateCardsOrPoliciesRead: false, networkSubmission: false }, limits: ["This records ordinary public UI and allowlisted numeric timings. It never supplies poker actions.", "No automatically inferred PASS, screen-reader speech, device identity, independent commit timestamp or new-user outcome.", "Capped raw records are disclosed. Quantiles become unavailable if a phase sample cap is reached.", "Keep separate runs for initial restoration, gameplay, history browsing and full audit; record the chosen phase in the observer notes."] };
    },
    close: () => {
      closed = true;
      observer.disconnect();
      performanceObservers.forEach((o) => o.disconnect());
      window.removeEventListener("ai-texas-performance-sample", timing);
      root.removeEventListener("click", click, true);
      if (frame) cancelAnimationFrame(frame);
    }
  };
}

// tests/browser/step5g-external-navigation.ts
function beginCandidateVerification(button, status2) {
  const hadFocus = button.ownerDocument.activeElement === button;
  status2.textContent = "Verifying candidate source and exact compiled assets\u2026";
  if (hadFocus) status2.focus({ preventScroll: true });
  button.disabled = true;
}
function focusCandidateApplication(app2) {
  const target = app2.querySelector("#main-content") ?? app2;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

// tests/browser/step5f-external.ts
var PRODUCTION_ORIGIN = "https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site";
var app = document.querySelector("#app");
var status = document.querySelector("#external-status");
var proof = document.querySelector("#external-proof");
var get = (id) => document.getElementById(id).value;
var hash = (bytes) => Array.from(sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
function required(value, message) {
  if (!value) throw Error(message);
}
var capture = null;
var identity = null;
var downloadURL = null;
document.querySelector("#external-start").onclick = () => {
  void (async () => {
    const button = document.querySelector("#external-start");
    beginCandidateVerification(button, status);
    try {
      required(location.origin !== PRODUCTION_ORIGIN, "Refusing to load this test harness on the production origin.");
      required(["http:", "https:"].includes(location.protocol), "Serve the candidate on a separate HTTP(S) origin; do not open it as a local file.");
      required(isSecureContext && !!crypto.subtle && !!indexedDB, "This candidate needs a secure context, browser cryptography and IndexedDB. Use localhost for desktop review or a separate authorized HTTPS origin for a physical device.");
      const params = new URLSearchParams(location.search), manifestURL = new URL(params.get("manifest") ?? app.dataset.externalManifest ?? "./step5f-candidate/manifest.json", location.href);
      required(manifestURL.origin === location.origin, "Candidate manifest must be on this isolated origin.");
      status.textContent = "Verifying candidate source and exact compiled assets\u2026";
      const response = await fetch(manifestURL);
      required(response.ok, "Candidate manifest is unavailable; the integrator must package a tested candidate first.");
      const manifestBytes = new Uint8Array(await response.arrayBuffer());
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      required(manifest.status === "BUILD_BYTES_VERIFIED" && /^[a-f0-9]{40}$/.test(manifest.sourceCommit), "Unverified candidate manifest.");
      required(Array.isArray(manifest.assets) && manifest.assets.length >= 3, "Candidate assets are missing.");
      const assets = [];
      for (const asset of manifest.assets) {
        const url = new URL(asset.url, manifestURL);
        required(url.origin === location.origin && /^[a-f0-9]{64}$/.test(asset.sha256), "Invalid candidate asset identity.");
        const result = await fetch(url);
        required(result.ok, "Candidate asset unavailable.");
        const bytes = new Uint8Array(await result.arrayBuffer());
        required(bytes.length === asset.bytes && hash(bytes) === asset.sha256, "Candidate asset hash/size mismatch.");
        assets.push({ source: asset.source, url: url.href, sha256: asset.sha256, bytes });
      }
      const html = assets.find((a) => a.source === "dist/index.html");
      required(html, "Compiled index is missing.");
      const index = new DOMParser().parseFromString(new TextDecoder().decode(html.bytes), "text/html");
      const declared = [...index.querySelectorAll('link[rel="stylesheet"],script[type="module"][src]')].map((e) => "dist" + (e.getAttribute("href") ?? e.getAttribute("src"))), runtime = assets.filter((a) => a !== html);
      required(declared.length === runtime.length && runtime.every((a) => declared.includes(a.source)) && runtime.filter((a) => a.source.endsWith(".js")).length === 1, "Expected one self-contained compiled application module and its declared styles.");
      let run = params.get("run");
      if (!run) {
        run = `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
        params.set("run", run);
        history.replaceState(null, "", `${location.pathname}?${params}`);
      }
      required(/^[A-Za-z0-9_-]{1,80}$/.test(run), "Invalid test run identity.");
      const namespace = `ai-texas-step5f-external-${run}`, nativeOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, version) => {
        required(name === "ai-texas-hold-em-guest", "Unexpected database request blocked by candidate isolation.");
        return nativeOpen(namespace, version);
      };
      identity = { sourceCommit: manifest.sourceCommit, executionReceipt: manifest.executionReceipt ?? "NOT_RECORDED", executionReceiptSHA256: manifest.executionReceiptSHA256 ?? "NOT_RECORDED", manifestURL: manifestURL.href, manifestSHA256: hash(manifestBytes), assets: assets.map(({ source, sha256: sha2562 }) => ({ source, sha256: sha2562 })), origin: location.origin, run, namespace, productionDatabaseAccessed: false, applicationBytesChanged: false, adapter: "Only default IndexedDB open is remapped; no poker action, controller, deck or private-state instrumentation.", performanceOptIn: params.get("measurePerformance") === "1" };
      capture = installExternalObserver(app);
      proof.textContent = JSON.stringify(identity, null, 2);
      for (const asset of runtime) {
        const css = asset.source.endsWith(".css"), url = URL.createObjectURL(new Blob([Uint8Array.from(asset.bytes).buffer], { type: css ? "text/css" : "text/javascript" }));
        if (css) {
          const element = document.createElement("link");
          element.rel = "stylesheet";
          element.href = url;
          document.head.append(element);
        } else {
          const element = document.createElement("script");
          element.type = "module";
          element.src = url;
          document.body.append(element);
        }
      }
      status.textContent = "Exact candidate assets verified. Use the ordinary table below. Loading and financial readiness are reported by the application.";
      document.querySelector("#external-jump-app").hidden = false;
      document.querySelector("#external-capture").disabled = false;
      document.querySelector("#external-new-measurement").disabled = false;
    } catch (error) {
      status.textContent = `BLOCKED: ${String(error)}`;
      proof.textContent = "No candidate verification PASS is inferred.";
    }
  })();
};
document.querySelector("#external-jump-app").onclick = (event) => {
  event.preventDefault();
  focusCandidateApplication(app);
};
document.querySelector("#external-capture").onclick = () => {
  if (!capture || !identity) return;
  const report = { format: "step5f-external-observation-file", version: 1, status: "OBSERVATIONS_ONLY", identity, operatorDeclared: { anonymousTester: get("tester-id"), hardwareKind: get("device-kind"), device: get("device-description"), browser: get("browser-description"), screenReader: get("reader-description"), phase: get("run-phase"), conditions: get("device-conditions"), observations: get("external-notes") }, measurements: capture.capture(), reviewRequired: "Operator declarations and structured observations do not independently verify physical hardware, speech or participant independence. No original acceptance requirement is automatically promoted." };
  const text = JSON.stringify(report, null, 2), file = new File([text], `ai-texas-candidate-observations-${Date.now()}.json`, { type: "application/json" });
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = URL.createObjectURL(file);
  const link = document.querySelector("#external-download");
  link.href = downloadURL;
  link.download = file.name;
  link.hidden = false;
  const copy = document.querySelector("#external-copy"), raw = document.querySelector("#external-json");
  raw.value = text;
  copy.hidden = false;
  copy.onclick = () => {
    raw.hidden = false;
    raw.focus();
    raw.select();
  };
  const share = document.querySelector("#external-share");
  share.hidden = !(navigator.canShare?.({ files: [file] }) && navigator.share);
  share.onclick = () => {
    void navigator.share({ files: [file], title: "AI Texas Hold Em candidate observations" }).then(() => {
      document.querySelector("#external-export-status").textContent = "Share request completed; independently check the saved file.";
    }).catch((error) => {
      document.querySelector("#external-export-status").textContent = `Share did not complete: ${String(error)}. Download or show/copy JSON remains available.`;
    });
  };
  document.querySelector("#external-export-status").textContent = "Observation file prepared. Actual download/share and app History export still need to be checked.";
};
document.querySelector("#external-new-measurement").onclick = () => {
  if (!capture) return;
  capture.close();
  capture = installExternalObserver(app);
  document.querySelector("#external-export-status").textContent = "New measurement window started. The prior prepared file remains available until the next capture. Poker state was not changed.";
};
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
