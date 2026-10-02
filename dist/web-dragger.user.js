// ==UserScript==
// @name         Web Markdown Block Dragger (GitHub / Gitea)
// @namespace    https://github.com/Ariestar/web-dragger
// @version      0.1.0
// @description  Drag and drop markdown blocks in GitHub, Gitea, and GitLab online editors
// @author       Ariestar
// @match        https://github.com/*
// @match        https://*.github.com/*
// @match        https://gitea.com/*
// @match        https://*.gitea.io/*
// @match        https://gitlab.com/*
// @match        https://*.gitlab.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/.pnpm/md-dragger@file+..+md-dragger_monaco-editor@0.57.0/node_modules/md-dragger/dist/npm/adapter/monaco.mjs
  function isHorizontalRuleLine(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;
    return /^([-*_])(?:\s*\1){2,}$/.test(trimmed);
  }
  function isBlockquoteLine(text) {
    if (!text) return false;
    return /^(> ?)+/.test(text.trimStart());
  }
  function isCalloutLine(text) {
    if (!text) return false;
    return /^(\s*> ?)+\s*\[!/.test(text.trimStart());
  }
  function isTableLine(text) {
    if (!text) return false;
    return text.trimStart().startsWith("|");
  }
  function isMathFenceLine(text) {
    if (!text) return false;
    return text.trimStart().startsWith("$$");
  }
  function isCodeFenceLine(text) {
    if (!text) return false;
    return text.trimStart().startsWith("```");
  }
  var fenceLazyScanCache = /* @__PURE__ */ new WeakMap();
  function isSingleLineMathFence(lineText) {
    const trimmed = lineText.trimStart();
    if (!trimmed.startsWith("$$")) return false;
    return trimmed.slice(2).includes("$$");
  }
  function assignFenceRangeByLine(rangeByLine, startLine, endLine) {
    const range = { startLine, endLine };
    for (let i = startLine; i <= endLine; i++) {
      rangeByLine.set(i, range);
    }
  }
  function createFenceLazyScanState() {
    return {
      scannedUntilLine: 0,
      openCodeStartLine: 0,
      openMathStartLine: 0,
      fullyScanned: false,
      codeRangeByLine: /* @__PURE__ */ new Map(),
      mathRangeByLine: /* @__PURE__ */ new Map()
    };
  }
  function getFenceLazyScanState(doc) {
    const cached = fenceLazyScanCache.get(doc);
    if (cached) return cached;
    const created = createFenceLazyScanState();
    fenceLazyScanCache.set(doc, created);
    return created;
  }
  function scanFenceLine(state, lineNumber, text) {
    if (state.openCodeStartLine !== 0) {
      if (isCodeFenceLine(text)) {
        assignFenceRangeByLine(state.codeRangeByLine, state.openCodeStartLine, lineNumber);
        state.openCodeStartLine = 0;
      }
      return;
    }
    if (state.openMathStartLine !== 0) {
      if (isMathFenceLine(text)) {
        assignFenceRangeByLine(state.mathRangeByLine, state.openMathStartLine, lineNumber);
        state.openMathStartLine = 0;
      }
      return;
    }
    if (isCodeFenceLine(text)) {
      state.openCodeStartLine = lineNumber;
      return;
    }
    if (isMathFenceLine(text)) {
      if (isSingleLineMathFence(text)) {
        assignFenceRangeByLine(state.mathRangeByLine, lineNumber, lineNumber);
      } else {
        state.openMathStartLine = lineNumber;
      }
    }
  }
  function finalizeFenceStateAtDocEnd(state) {
    if (state.openCodeStartLine !== 0) {
      assignFenceRangeByLine(state.codeRangeByLine, state.openCodeStartLine, state.openCodeStartLine);
      state.openCodeStartLine = 0;
    }
    state.openMathStartLine = 0;
    state.fullyScanned = true;
  }
  function ensureFenceScanComplete(doc) {
    const state = getFenceLazyScanState(doc);
    if (state.fullyScanned) return state;
    let cursor = state.scannedUntilLine + 1;
    while (cursor <= doc.lines) {
      scanFenceLine(state, cursor, doc.line(cursor).text);
      cursor++;
    }
    state.scannedUntilLine = Math.max(state.scannedUntilLine, cursor - 1);
    finalizeFenceStateAtDocEnd(state);
    return state;
  }
  function findMathBlockRange(doc, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    const state = ensureFenceScanComplete(doc);
    return (_a = state.mathRangeByLine.get(lineNumber)) != null ? _a : null;
  }
  function findCodeBlockRange(doc, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    const state = ensureFenceScanComplete(doc);
    return (_a = state.codeRangeByLine.get(lineNumber)) != null ? _a : null;
  }
  function indentWidth(raw, tabSize) {
    let width = 0;
    for (const ch of raw) {
      width += ch === "	" ? tabSize : 1;
    }
    return width;
  }
  function splitQuote(line) {
    const match = line.match(/^(\s*> ?)+/);
    if (!match) return { prefix: "", depth: 0, rest: line };
    const prefix = match[0];
    return {
      prefix,
      depth: (prefix.match(/>/g) || []).length,
      rest: line.slice(prefix.length)
    };
  }
  function parseMarkerAndBody(rest) {
    var _a;
    const indentMatch = rest.match(/^(\s*)/);
    const indentRaw = (_a = indentMatch == null ? void 0 : indentMatch[1]) != null ? _a : "";
    const afterIndent = rest.slice(indentRaw.length);
    const headingMatch = afterIndent.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const text = headingMatch[0];
      const level = headingMatch[1].length;
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "heading", text, level },
        body: afterIndent.slice(text.length)
      };
    }
    if (isHorizontalRuleLine(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "hr", text: afterIndent },
        body: ""
      };
    }
    if (isCodeFenceLine(afterIndent)) {
      const info = afterIndent.replace(/^```\s*/, "").trim() || void 0;
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "fence", text: afterIndent, fence: "code", info },
        body: ""
      };
    }
    if (isMathFenceLine(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "fence", text: afterIndent, fence: "math" },
        body: ""
      };
    }
    if (isTableLine(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "table-row", text: afterIndent },
        body: ""
      };
    }
    if (isCalloutLine(afterIndent) || /^\[![^\]]+\]/.test(afterIndent)) {
      const m = afterIndent.match(/^\[!([^\]]+)\]\s*/);
      if (m) {
        return {
          indent: { raw: indentRaw, width: 0 },
          marker: { kind: "callout", text: m[0], calloutType: m[1] },
          body: afterIndent.slice(m[0].length)
        };
      }
    }
    const taskMatch = afterIndent.match(/^([-*+])\s\[([ xX])\]\s+/);
    if (taskMatch) {
      const text = taskMatch[0];
      const checked = taskMatch[2] !== " ";
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "task", checked },
        body: afterIndent.slice(text.length)
      };
    }
    const unorderedMatch = afterIndent.match(/^([-*+])\s+/);
    if (unorderedMatch) {
      const text = unorderedMatch[0];
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "unordered" },
        body: afterIndent.slice(text.length)
      };
    }
    const orderedMatch = afterIndent.match(/^(\d+)[.)]\s+/);
    if (orderedMatch) {
      const text = orderedMatch[0];
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "ordered" },
        body: afterIndent.slice(text.length)
      };
    }
    return {
      indent: { raw: indentRaw, width: 0 },
      marker: null,
      body: afterIndent
    };
  }
  function parseLine(text, tabSize) {
    const { prefix, depth, rest } = splitQuote(text);
    const { indent, marker, body } = parseMarkerAndBody(rest);
    return {
      raw: text,
      quote: { depth, prefix },
      indent: {
        raw: indent.raw,
        width: indentWidth(indent.raw, tabSize)
      },
      marker,
      body
    };
  }
  function isListLine(p) {
    var _a;
    return ((_a = p.marker) == null ? void 0 : _a.kind) === "list";
  }
  function listMarkerText(p) {
    var _a;
    return ((_a = p.marker) == null ? void 0 : _a.kind) === "list" ? p.marker.text : "";
  }
  function listMarkerType(p) {
    var _a;
    return ((_a = p.marker) == null ? void 0 : _a.kind) === "list" ? p.marker.markerType : null;
  }
  function formatIndent(width, tabSize, sample = " ") {
    const safeWidth = Math.max(0, width);
    if (safeWidth === 0) return "";
    if (sample.includes("	")) {
      const tabs = Math.floor(safeWidth / tabSize);
      const spaces = safeWidth - tabs * tabSize;
      return "	".repeat(tabs) + " ".repeat(spaces);
    }
    return " ".repeat(safeWidth);
  }
  var lineMapCache = /* @__PURE__ */ new WeakMap();
  var EMPTY_LINE_META = {
    isEmpty: true,
    isList: false,
    isQuote: false,
    isCallout: false,
    isTable: false,
    isHr: false,
    indentWidth: 0,
    quoteDepth: 0
  };
  function createLineMetaFromText(text, tabSize) {
    const parsed = parseLine(text, tabSize);
    const isEmpty = text.trim().length === 0;
    return {
      isEmpty,
      isList: isListLine(parsed),
      isQuote: parsed.quote.depth > 0,
      isCallout: isCalloutLine(text),
      isTable: text.trimStart().startsWith("|"),
      isHr: isHorizontalRuleLine(text),
      indentWidth: parsed.indent.width,
      quoteDepth: parsed.quote.depth
    };
  }
  function createLineMetaArray(doc, tabSize) {
    var _a;
    const lineMeta = Array(doc.lines + 1);
    lineMeta[0] = EMPTY_LINE_META;
    for (let i = 1; i <= doc.lines; i++) {
      lineMeta[i] = createLineMetaFromText((_a = doc.line(i).text) != null ? _a : "", tabSize);
    }
    return lineMeta;
  }
  function buildLineMapIndexes(lineMeta, totalLines) {
    var _a, _b, _c;
    const prevNonEmpty2 = new Int32Array(totalLines + 2);
    const nextNonEmpty2 = new Int32Array(totalLines + 2);
    const prevListLine = new Int32Array(totalLines + 2);
    const listParentLine = new Int32Array(totalLines + 2);
    const listSubtreeEndLine = new Int32Array(totalLines + 2);
    let previous = 0;
    let previousList = 0;
    const listStack = [];
    for (let i = 1; i <= totalLines; i++) {
      const meta = (_a = lineMeta[i]) != null ? _a : EMPTY_LINE_META;
      if (!meta.isEmpty) {
        previous = i;
      }
      prevNonEmpty2[i] = previous;
      if (meta.isEmpty) {
        prevListLine[i] = previousList;
        continue;
      }
      while (listStack.length > 0) {
        const topLine = listStack[listStack.length - 1];
        const topMeta = (_b = lineMeta[topLine]) != null ? _b : EMPTY_LINE_META;
        if (meta.indentWidth > topMeta.indentWidth) {
          break;
        }
        listStack.pop();
      }
      for (const ancestorLine of listStack) {
        listSubtreeEndLine[ancestorLine] = i;
      }
      prevListLine[i] = previousList;
      if (!meta.isList) {
        continue;
      }
      listParentLine[i] = listStack.length > 0 ? listStack[listStack.length - 1] : 0;
      listSubtreeEndLine[i] = i;
      listStack.push(i);
      previousList = i;
    }
    let next = 0;
    for (let i = totalLines; i >= 1; i--) {
      const meta = (_c = lineMeta[i]) != null ? _c : EMPTY_LINE_META;
      if (!meta.isEmpty) {
        next = i;
      }
      nextNonEmpty2[i] = next;
    }
    return {
      prevNonEmpty: prevNonEmpty2,
      nextNonEmpty: nextNonEmpty2,
      prevListLine,
      listParentLine,
      listSubtreeEndLine
    };
  }
  function createLineMapFromMeta(doc, tabSize, lineMeta) {
    const indexes = buildLineMapIndexes(lineMeta, doc.lines);
    return {
      doc,
      lineMeta,
      prevNonEmpty: indexes.prevNonEmpty,
      nextNonEmpty: indexes.nextNonEmpty,
      prevListLine: indexes.prevListLine,
      listParentLine: indexes.listParentLine,
      listSubtreeEndLine: indexes.listSubtreeEndLine,
      tabSize
    };
  }
  function buildLineMap(doc, options) {
    const tabSize = options.tabSize;
    const lineMeta = createLineMetaArray(doc, tabSize);
    return createLineMapFromMeta(doc, tabSize, lineMeta);
  }
  function getCachedLineMapForDoc(doc, tabSize) {
    var _a, _b;
    if (!doc || typeof doc !== "object") return null;
    return (_b = (_a = lineMapCache.get(doc)) == null ? void 0 : _a.get(tabSize)) != null ? _b : null;
  }
  function setCachedLineMapForDoc(doc, tabSize, lineMap) {
    const byTabSize = lineMapCache.get(doc);
    if (byTabSize) {
      byTabSize.set(tabSize, lineMap);
      return;
    }
    lineMapCache.set(doc, /* @__PURE__ */ new Map([[tabSize, lineMap]]));
  }
  function getLineMap(doc, options) {
    const tabSize = options.tabSize;
    if (!doc || typeof doc !== "object") {
      return buildLineMap(doc, { tabSize });
    }
    const cached = getCachedLineMapForDoc(doc, tabSize);
    if (cached) {
      return cached;
    }
    const built = buildLineMap(doc, { tabSize });
    setCachedLineMapForDoc(doc, tabSize, built);
    return built;
  }
  function peekCachedLineMap(doc, options) {
    const tabSize = options.tabSize;
    if (!doc || typeof doc !== "object") return null;
    return getCachedLineMapForDoc(doc, tabSize);
  }
  function getLineMetaAt(lineMap, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber >= lineMap.lineMeta.length) return null;
    return (_a = lineMap.lineMeta[lineNumber]) != null ? _a : null;
  }
  function listLineAtOrAbove(lineMap, lineNumber) {
    if (lineMap.doc.lines <= 0) return null;
    const clamped = Math.max(1, Math.min(lineMap.doc.lines, lineNumber));
    const meta = getLineMetaAt(lineMap, clamped);
    if (meta == null ? void 0 : meta.isList) return clamped;
    const prevListLine = lineMap.prevListLine[clamped];
    return prevListLine > 0 ? prevListLine : null;
  }
  var BlockType = /* @__PURE__ */ ((BlockType22) => {
    BlockType22["Paragraph"] = "paragraph";
    BlockType22["Heading"] = "heading";
    BlockType22["ListItem"] = "list-item";
    BlockType22["CodeBlock"] = "code-block";
    BlockType22["Blockquote"] = "blockquote";
    BlockType22["Table"] = "table";
    BlockType22["MathBlock"] = "math-block";
    BlockType22["Callout"] = "callout";
    BlockType22["HorizontalRule"] = "hr";
    BlockType22["Unknown"] = "unknown";
    return BlockType22;
  })(BlockType || {});
  function detectBlockType(lineText, tabSize) {
    var _a, _b, _c, _d, _e, _f;
    const p = parseLine(lineText, tabSize);
    if (((_a = p.marker) == null ? void 0 : _a.kind) === "heading") return "heading";
    if (((_b = p.marker) == null ? void 0 : _b.kind) === "hr") return "hr";
    if (((_c = p.marker) == null ? void 0 : _c.kind) === "list") return "list-item";
    if (((_d = p.marker) == null ? void 0 : _d.kind) === "fence") {
      return p.marker.fence === "code" ? "code-block" : "math-block";
    }
    if (((_e = p.marker) == null ? void 0 : _e.kind) === "table-row") return "table";
    if (((_f = p.marker) == null ? void 0 : _f.kind) === "callout") return "callout";
    if (p.quote.depth > 0) return "blockquote";
    if (p.body.trim().length === 0 && !p.marker) return "unknown";
    return "paragraph";
  }
  function isCalloutHeaderLine(text, tabSize) {
    var _a;
    return ((_a = parseLine(text, tabSize).marker) == null ? void 0 : _a.kind) === "callout";
  }
  function isInsideCalloutContainer(doc, lineNumber, depth, tabSize) {
    var _a;
    for (let i = lineNumber; i >= 1; i--) {
      const text = doc.line(i).text;
      const p = parseLine(text, tabSize);
      if (p.quote.depth === 0 || p.quote.depth < depth) break;
      if (((_a = p.marker) == null ? void 0 : _a.kind) === "callout" || isCalloutHeaderLine(text, tabSize)) return true;
    }
    return false;
  }
  function getBlockquoteContainerRange(doc, lineNumber, depth, tabSize) {
    let startLine = lineNumber;
    for (let i = lineNumber - 1; i >= 1; i--) {
      const d = parseLine(doc.line(i).text, tabSize).quote.depth;
      if (d === 0 || d < depth) break;
      startLine = i;
    }
    let endLine = lineNumber;
    for (let i = lineNumber + 1; i <= doc.lines; i++) {
      const d = parseLine(doc.line(i).text, tabSize).quote.depth;
      if (d === 0 || d < depth) break;
      endLine = i;
    }
    return { startLine, endLine };
  }
  function getListItemSubtreeRange(doc, lineNumber, tabSize) {
    const current = parseLine(doc.line(lineNumber).text, tabSize);
    const currentIndent = current.indent.width;
    let endLine = lineNumber;
    for (let i = lineNumber + 1; i <= doc.lines; i++) {
      const nextText = doc.line(i).text;
      if (nextText.trim().length === 0) {
        const lookahead = findNextNonEmptyLine(doc, i + 1, tabSize);
        if (!lookahead || lookahead.isList && lookahead.indentWidth <= currentIndent || lookahead.indentWidth <= currentIndent) {
          break;
        }
        endLine = i;
        continue;
      }
      const next = parseLine(nextText, tabSize);
      if (isListLine(next) && next.indent.width <= currentIndent) {
        break;
      }
      if (isListLine(next) || next.indent.width > currentIndent) {
        endLine = i;
        continue;
      }
      break;
    }
    return { startLine: lineNumber, endLine };
  }
  function findNextNonEmptyLine(doc, fromLine, tabSize) {
    for (let i = fromLine; i <= doc.lines; i++) {
      const text = doc.line(i).text;
      if (text.trim().length === 0) continue;
      const p = parseLine(text, tabSize);
      return { isList: isListLine(p), indentWidth: p.indent.width };
    }
    return null;
  }
  var blockDetectionCache = /* @__PURE__ */ new WeakMap();
  var LINE_MAP_EAGER_MAX = 3e4;
  var YAML_FENCE_RE = /^-{3}\s*$/;
  var yamlEndCache = /* @__PURE__ */ new WeakMap();
  function yamlEndLine(doc) {
    const cached = yamlEndCache.get(doc);
    if (cached !== void 0) return cached;
    let endLine = 0;
    if (doc.lines >= 2 && YAML_FENCE_RE.test(doc.line(1).text)) {
      for (let i = 2; i <= doc.lines; i++) {
        if (YAML_FENCE_RE.test(doc.line(i).text)) {
          endLine = i;
          break;
        }
      }
    }
    yamlEndCache.set(doc, endLine);
    return endLine;
  }
  function inYamlFrontmatter(doc, lineNumber) {
    const endLine = yamlEndLine(doc);
    return endLine > 0 && lineNumber >= 1 && lineNumber <= endLine;
  }
  function detectBlockUncached(doc, lineNumber, tabSize) {
    if (lineNumber < 1 || lineNumber > doc.lines) {
      return null;
    }
    if (inYamlFrontmatter(doc, lineNumber)) {
      return null;
    }
    const lineText = doc.line(lineNumber).text;
    let blockType = detectBlockType(lineText, tabSize);
    const codeRange = findCodeBlockRange(doc, lineNumber);
    const mathRange = findMathBlockRange(doc, lineNumber);
    if (codeRange) {
      blockType = "code-block";
    }
    if (mathRange) {
      blockType = "math-block";
    }
    if (blockType === "unknown") {
      return null;
    }
    let startLine = lineNumber;
    let endLine = lineNumber;
    if (blockType === "code-block" && codeRange) {
      startLine = codeRange.startLine;
      endLine = codeRange.endLine;
    }
    if (blockType === "math-block" && mathRange) {
      startLine = mathRange.startLine;
      endLine = mathRange.endLine;
    }
    if (blockType === "list-item") {
      let lineMap = peekCachedLineMap(doc, { tabSize });
      if (!lineMap && doc.lines <= LINE_MAP_EAGER_MAX) {
        lineMap = getLineMap(doc, { tabSize });
      }
      const lineMeta = lineMap ? getLineMetaAt(lineMap, lineNumber) : null;
      const subtreeEndLine = (lineMeta == null ? void 0 : lineMeta.isList) && lineMap ? lineMap.listSubtreeEndLine[lineNumber] : 0;
      if (subtreeEndLine >= lineNumber) {
        endLine = subtreeEndLine;
      } else {
        endLine = getListItemSubtreeRange(doc, lineNumber, tabSize).endLine;
      }
    }
    if (blockType === "blockquote" || blockType === "callout") {
      const quoteDepth = parseLine(lineText, tabSize).quote.depth;
      const inCallout = blockType === "callout" || isInsideCalloutContainer(doc, lineNumber, quoteDepth, tabSize);
      if (inCallout) {
        const range = getBlockquoteContainerRange(doc, lineNumber, quoteDepth, tabSize);
        startLine = range.startLine;
        endLine = range.endLine;
        blockType = "callout";
      } else {
        startLine = lineNumber;
        endLine = lineNumber;
        blockType = "blockquote";
      }
    }
    if (blockType === "table") {
      for (let i = lineNumber - 1; i >= 1; i--) {
        if (isTableLine(doc.line(i).text)) startLine = i;
        else break;
      }
      for (let i = lineNumber + 1; i <= doc.lines; i++) {
        if (isTableLine(doc.line(i).text)) endLine = i;
        else break;
      }
    }
    return {
      type: blockType,
      lines: { startLine, endLine }
    };
  }
  function detectBlock(doc, lineNumber, options) {
    var _a;
    const tabSize = options.tabSize;
    let cacheByTabSize = blockDetectionCache.get(doc);
    if (!cacheByTabSize) {
      cacheByTabSize = /* @__PURE__ */ new Map();
      blockDetectionCache.set(doc, cacheByTabSize);
    }
    let perDocCache = cacheByTabSize.get(tabSize);
    if (!perDocCache) {
      perDocCache = /* @__PURE__ */ new Map();
      cacheByTabSize.set(tabSize, perDocCache);
    }
    if (perDocCache.has(lineNumber)) {
      return (_a = perDocCache.get(lineNumber)) != null ? _a : null;
    }
    const block = detectBlockUncached(doc, lineNumber, tabSize);
    if (block) {
      perDocCache.set(block.lines.startLine, block);
      for (let n = block.lines.startLine + 1; n <= block.lines.endLine; n++) {
        if (isListLine(parseLine(doc.line(n).text, tabSize))) {
          continue;
        }
        perDocCache.set(n, block);
      }
    } else {
      perDocCache.set(lineNumber, null);
    }
    return block;
  }
  var ALL_TYPES = Object.values(BlockType);
  function rejectEntries(types, slot, reason) {
    return types.map((t) => [`${t}|${slot}`, reason]);
  }
  var REJECT_RULES = new Map([
    ...rejectEntries(ALL_TYPES, "inside_code_block", "inside_code_block"),
    ...rejectEntries(ALL_TYPES, "inside_math_block", "inside_math_block"),
    ...rejectEntries(
      ALL_TYPES.filter(
        (t) => t !== "list-item"
        /* ListItem */
      ),
      "inside_list",
      "inside_list"
    ),
    ...rejectEntries(
      ALL_TYPES.filter(
        (t) => t !== "blockquote"
        /* Blockquote */
      ),
      "inside_quote_run",
      "inside_quote_run"
    ),
    ...rejectEntries([
      "callout"
      /* Callout */
    ], "quote_before", "quote_boundary"),
    ...rejectEntries(
      ALL_TYPES.filter(
        (t) => t !== "blockquote"
        /* Blockquote */
      ),
      "quote_after",
      "quote_boundary"
    ),
    ...rejectEntries(ALL_TYPES, "callout_after", "callout_after"),
    ...rejectEntries(ALL_TYPES, "table_before", "table_before"),
    ...rejectEntries(ALL_TYPES, "hr_before", "hr_before")
  ]);
  function resolveInsertionRule(input) {
    var _a;
    const key = `${input.sourceType}|${input.slotContext}`;
    const rejectReason = (_a = REJECT_RULES.get(key)) != null ? _a : null;
    return {
      allowDrop: rejectReason === null,
      rejectReason
    };
  }
  function getImmediateLineText(doc, lineNumber) {
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    return doc.line(lineNumber).text;
  }
  function getActiveLineMap(doc, options) {
    var _a;
    return (_a = options.lineMap) != null ? _a : getLineMap(doc, { tabSize: options.tabSize });
  }
  function prevNonEmpty(doc, lineNumber, lineMap) {
    if (doc.lines <= 0) return null;
    const clampedLine = Math.max(1, Math.min(doc.lines, lineNumber));
    const prev = lineMap.prevNonEmpty[clampedLine];
    return prev > 0 ? prev : null;
  }
  function nextNonEmpty(doc, lineNumber, lineMap) {
    if (doc.lines <= 0) return null;
    const clampedLine = Math.max(1, Math.min(doc.lines, lineNumber));
    const next = lineMap.nextNonEmpty[clampedLine];
    return next > 0 ? next : null;
  }
  function findEnclosingListBlock(doc, lineNumber, options) {
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    const lineMap = getActiveLineMap(doc, options);
    const radius = 8;
    const minLine = Math.max(1, lineNumber - radius);
    const maxLine = Math.min(doc.lines, lineNumber + radius);
    let best = null;
    for (let ln = minLine; ln <= maxLine; ln++) {
      const meta = getLineMetaAt(lineMap, ln);
      if (meta && !meta.isList) continue;
      const block = detectBlock(doc, ln, { tabSize: lineMap.tabSize });
      if (!block || block.type !== "list-item") continue;
      const blockStart = block.lines.startLine;
      const blockEnd = block.lines.endLine;
      if (lineNumber < blockStart || lineNumber > blockEnd) continue;
      if (!best || block.lines.endLine - block.lines.startLine > best.lines.endLine - best.lines.startLine) {
        best = block;
      }
    }
    return best;
  }
  function isTableBlockStartAtLine(doc, lineNumber, options) {
    if (lineNumber < 1 || lineNumber > doc.lines) return false;
    const block = detectBlock(doc, lineNumber, options);
    return !!block && block.type === "table" && block.lines.startLine === lineNumber;
  }
  function isHorizontalRuleAtLine(doc, lineNumber, options) {
    if (lineNumber < 1 || lineNumber > doc.lines) return false;
    const block = detectBlock(doc, lineNumber, options);
    if (block) {
      return block.type === "hr" && block.lines.startLine === lineNumber;
    }
    return isHorizontalRuleLine(doc.line(lineNumber).text);
  }
  function isCalloutAfterBoundary(doc, prevImmediateLine, nextIsQuoteLike, options) {
    if (prevImmediateLine < 1 || prevImmediateLine > doc.lines) return false;
    if (nextIsQuoteLike) return false;
    const prevBlock = detectBlock(doc, prevImmediateLine, options);
    return !!prevBlock && prevBlock.type === "callout" && prevBlock.lines.endLine === prevImmediateLine;
  }
  function listSlotAt(doc, targetLineNumber, options) {
    if (doc.lines <= 0) return null;
    const lineMap = getActiveLineMap(doc, options);
    const candidates = [
      targetLineNumber - 1,
      targetLineNumber,
      targetLineNumber + 1,
      prevNonEmpty(doc, targetLineNumber - 1, lineMap),
      nextNonEmpty(doc, targetLineNumber, lineMap)
    ].filter((v) => typeof v === "number" && v >= 1 && v <= doc.lines);
    const seen = /* @__PURE__ */ new Set();
    let best = null;
    for (const line of candidates) {
      if (seen.has(line)) continue;
      seen.add(line);
      const lineMeta = getLineMetaAt(lineMap, line);
      if (lineMeta && !lineMeta.isList) continue;
      const block = findEnclosingListBlock(doc, line, {
        lineMap,
        tabSize: options.tabSize
      });
      if (!block) continue;
      const blockTopBoundary = block.lines.startLine;
      const blockBottomBoundary = block.lines.endLine + 1;
      const isInsideContainer = targetLineNumber > blockTopBoundary && targetLineNumber < blockBottomBoundary;
      if (!isInsideContainer) continue;
      if (!best || block.lines.endLine - block.lines.startLine > best.lines.endLine - best.lines.startLine) {
        best = block;
      }
    }
    if (!best) return null;
    return { type: "list-item", block: best };
  }
  function slotAt(doc, targetLineNumber, options) {
    const lineMap = getActiveLineMap(doc, options);
    const clampedTarget = Math.max(1, Math.min(doc.lines + 1, targetLineNumber));
    const prevImmediateLine = clampedTarget - 1;
    const nextImmediateLine = clampedTarget <= doc.lines ? clampedTarget : null;
    const prevMeta = getLineMetaAt(lineMap, prevImmediateLine);
    const nextMeta = nextImmediateLine === null ? null : getLineMetaAt(lineMap, nextImmediateLine);
    const prevImmediateText = prevMeta ? null : getImmediateLineText(doc, prevImmediateLine);
    const nextImmediateText = nextMeta || nextImmediateLine === null ? null : getImmediateLineText(doc, nextImmediateLine);
    const prevIsQuoteLike = prevMeta ? prevMeta.isQuote : isBlockquoteLine(prevImmediateText);
    const nextIsQuoteLike = nextMeta ? nextMeta.isQuote : isBlockquoteLine(nextImmediateText);
    const detectOptions = { tabSize: options.tabSize };
    const targetBlock = detectBlock(doc, clampedTarget, detectOptions);
    if (targetBlock && (targetBlock.type === "code-block" || targetBlock.type === "math-block") && clampedTarget > targetBlock.lines.startLine && clampedTarget <= targetBlock.lines.endLine) {
      return targetBlock.type === "math-block" ? "inside_math_block" : "inside_code_block";
    }
    if (isCalloutAfterBoundary(doc, prevImmediateLine, nextIsQuoteLike, detectOptions)) {
      return "callout_after";
    }
    if (nextImmediateLine !== null && isTableBlockStartAtLine(doc, nextImmediateLine, detectOptions)) {
      return "table_before";
    }
    if (nextImmediateLine !== null && isHorizontalRuleAtLine(doc, nextImmediateLine, detectOptions)) {
      return "hr_before";
    }
    if (prevIsQuoteLike && nextIsQuoteLike) {
      return "inside_quote_run";
    }
    if (!prevIsQuoteLike && nextIsQuoteLike) {
      return "quote_before";
    }
    if (prevIsQuoteLike && !nextIsQuoteLike) {
      return "quote_after";
    }
    const listContext = listSlotAt(doc, clampedTarget, { lineMap, tabSize: options.tabSize });
    if (listContext) {
      return "inside_list";
    }
    return "outside";
  }
  function canDropAt(doc, sourceBlock, targetLineNumber, options) {
    var _a;
    const lineMap = (_a = options.lineMap) != null ? _a : getLineMap(doc, { tabSize: options.tabSize });
    const slotContext = slotAt(doc, targetLineNumber, { lineMap, tabSize: options.tabSize });
    const decision = resolveInsertionRule({
      sourceType: sourceBlock.type,
      slotContext
    });
    return { slotContext, decision };
  }
  function normalizeLineRange(docLines, startLine, endLine) {
    if (docLines <= 0) {
      return { startLine: 1, endLine: 1 };
    }
    const safeStart = Math.max(1, Math.min(docLines, Math.min(startLine, endLine)));
    const safeEnd = Math.max(1, Math.min(docLines, Math.max(startLine, endLine)));
    return { startLine: safeStart, endLine: safeEnd };
  }
  function mergeLineRanges(docLines, ranges) {
    const normalized = ranges.map((range) => normalizeLineRange(docLines, range.startLine, range.endLine)).sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
    const merged = [];
    for (const range of normalized) {
      const last = merged[merged.length - 1];
      if (!last || range.startLine > last.endLine + 1) {
        merged.push({ ...range });
        continue;
      }
      if (range.endLine > last.endLine) {
        last.endLine = range.endLine;
      }
    }
    return merged;
  }
  function isLineNumberInRanges(line, ranges) {
    for (const range of ranges) {
      if (line >= range.startLine && line <= range.endLine) return true;
    }
    return false;
  }
  function blockKey(block) {
    return `${block.lines.startLine}:${block.lines.endLine}`;
  }
  function selectOne(block) {
    return { blocks: [block] };
  }
  function selectBlocks(blocks) {
    const sorted = [...blocks].sort(
      (a, b) => a.lines.startLine - b.lines.startLine || a.lines.endLine - b.lines.endLine
    );
    return { blocks: sorted };
  }
  function addBlocks(selection, blocks) {
    const map = new Map(selection.blocks.map((b) => [blockKey(b), b]));
    for (const block of blocks) {
      map.set(blockKey(block), block);
    }
    return selectBlocks([...map.values()]);
  }
  function removeBlocks(selection, blocks) {
    const remove = new Set(blocks.map(blockKey));
    return selectBlocks(selection.blocks.filter((b) => !remove.has(blockKey(b))));
  }
  function hasBlock(selection, block) {
    const key = blockKey(block);
    return selection.blocks.some((b) => blockKey(b) === key);
  }
  function selectionLineRanges(docLines, selection) {
    return mergeLineRanges(
      docLines,
      selection.blocks.map((block) => block.lines)
    );
  }
  function isListSelection(params) {
    var _a;
    const { doc, source, parse, ranges } = params;
    if (((_a = source.blocks[0]) == null ? void 0 : _a.type) !== "list-item") return false;
    for (const range of ranges) {
      let foundContent = false;
      for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber++) {
        const text = doc.line(lineNumber).text;
        if (text.trim().length === 0) continue;
        foundContent = true;
        if (!isListLine(parse(text))) return false;
      }
      if (!foundContent) return false;
    }
    return true;
  }
  function selfDrop(params) {
    var _a;
    const { doc, source, targetLineNumber, parseLineWithQuote: parse, lineMap, position, tabSize, indentUnit } = params;
    const sourceBlock = source.blocks[0];
    if (!sourceBlock) {
      return { inSelfRange: false, allowInPlaceIndentChange: false, rejectReason: "self_range_blocked" };
    }
    const sourceRanges = selectionLineRanges(doc.lines, source);
    if (sourceRanges.length === 0) {
      return { inSelfRange: false, allowInPlaceIndentChange: false };
    }
    const effectiveSourceRange = {
      startLine: sourceRanges[0].startLine,
      endLine: sourceRanges[sourceRanges.length - 1].endLine
    };
    const inSelectedRange = isLineNumberInRanges(targetLineNumber, sourceRanges);
    const inSelfRange = inSelectedRange || targetLineNumber === effectiveSourceRange.endLine + 1;
    if (!inSelfRange) {
      return { inSelfRange: false, allowInPlaceIndentChange: false };
    }
    if (!position) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked"
      };
    }
    const targetIndentWidth = dropIndentWidth(position, { tabSize, indentUnit });
    const hasListIntent = ((_a = position.parent) == null ? void 0 : _a.type) === "list-item" || sourceBlock.type === "list-item";
    if (!hasListIntent) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked"
      };
    }
    if (!isListSelection({ doc, source, parse, ranges: sourceRanges })) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked"
      };
    }
    const sourceLineNumber = effectiveSourceRange.startLine;
    const sourceLineMeta = lineMap ? getLineMetaAt(lineMap, sourceLineNumber) : null;
    if (sourceLineMeta && !sourceLineMeta.isList) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked"
      };
    }
    const sourceParsed = parse(doc.line(sourceLineNumber).text);
    if (!isListLine(sourceParsed)) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked"
      };
    }
    const sourceIndent = sourceParsed.indent.width;
    const isAfterSelf = targetLineNumber === effectiveSourceRange.endLine + 1;
    const isSameLine = targetLineNumber === effectiveSourceRange.startLine;
    if (isAfterSelf && position.parent && isLineNumberInRanges(position.parent.lines.startLine, sourceRanges) && targetIndentWidth > sourceIndent) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_embedding",
        targetIndentWidth
      };
    }
    const allowInPlaceIndentChange = isAfterSelf && targetIndentWidth !== sourceIndent || isSameLine && targetIndentWidth !== sourceIndent || !isAfterSelf && targetIndentWidth < sourceIndent;
    if (!allowInPlaceIndentChange) {
      return {
        inSelfRange: true,
        allowInPlaceIndentChange: false,
        rejectReason: "self_range_blocked",
        targetIndentWidth
      };
    }
    return {
      inSelfRange: true,
      allowInPlaceIndentChange: true,
      targetIndentWidth
    };
  }
  function resolveInsertionChange(doc, targetLineNumber, insertText, options) {
    var _a;
    if (targetLineNumber <= doc.lines) {
      return {
        pos: doc.line(targetLineNumber).from,
        text: insertText
      };
    }
    const normalized = insertText.endsWith("\n") ? insertText.slice(0, -1) : insertText;
    if (!normalized.length) {
      return { pos: doc.length, text: normalized };
    }
    const lengthAfterDelete = (_a = options == null ? void 0 : options.lengthAfterDelete) != null ? _a : doc.length;
    if (lengthAfterDelete <= 0) {
      return { pos: 0, text: normalized };
    }
    return {
      pos: doc.length,
      text: `
${normalized}`
    };
  }
  function resolveDeleteRange(doc, sourceFrom, sourceTo) {
    if (sourceTo < doc.length) {
      return {
        from: sourceFrom,
        to: Math.min(sourceTo + 1, doc.length)
      };
    }
    if (sourceFrom > 0) {
      return {
        from: sourceFrom - 1,
        to: sourceTo
      };
    }
    return {
      from: sourceFrom,
      to: sourceTo
    };
  }
  function getSourceListBase(lines, parse) {
    for (const line of lines) {
      const parsed = parse(line);
      if (isListLine(parsed)) {
        return { indentWidth: parsed.indent.width, indentRaw: parsed.indent.raw };
      }
    }
    return null;
  }
  function relevelListText(params) {
    const { sourceContent, parse, formatIndentFn, targetIndentWidth } = params;
    const lines = sourceContent.split("\n");
    const sourceBase = getSourceListBase(lines, parse);
    if (!sourceBase) return sourceContent;
    const delta = targetIndentWidth - sourceBase.indentWidth;
    if (delta === 0) return sourceContent;
    return lines.map((line) => {
      if (line.trim().length === 0) return line;
      const parsed = parse(line);
      const markerText = parsed.marker && parsed.marker.kind === "list" ? parsed.marker.text : "";
      const afterIndent = markerText + parsed.body;
      if (!isListLine(parsed)) {
        if (parsed.indent.width >= sourceBase.indentWidth) {
          const newIndent2 = formatIndentFn(sourceBase.indentRaw, Math.max(0, parsed.indent.width + delta));
          return `${parsed.quote.prefix}${newIndent2}${afterIndent}`;
        }
        return line;
      }
      const newIndent = formatIndentFn(sourceBase.indentRaw, Math.max(0, parsed.indent.width + delta));
      return `${parsed.quote.prefix}${newIndent}${markerText}${parsed.body}`;
    }).join("\n");
  }
  function insertTextForMove(params) {
    var _a;
    const { sourceBlock, sourceContent, position, tabSize, indentUnit } = params;
    const parse = (line) => parseLine(line, tabSize);
    let text = sourceContent;
    const nestList = sourceBlock.type === "list-item" || ((_a = position.parent) == null ? void 0 : _a.type) === "list-item";
    if (sourceBlock.type !== "blockquote" && nestList) {
      const targetIndentWidth = dropIndentWidth(position, { tabSize, indentUnit });
      text = relevelListText({
        sourceContent: text,
        parse,
        formatIndentFn: (sample, width) => formatIndent(width, tabSize, sample),
        targetIndentWidth
      });
    }
    return text.endsWith("\n") ? text : `${text}
`;
  }
  function reject(reason) {
    return { type: "reject", reason };
  }
  function renumberList(doc, parse, line) {
    if (line < 1 || line > doc.lines) return [];
    const at = (n2) => {
      const p = parse(doc.line(n2).text);
      if (!isListLine(p) || listMarkerType(p) !== "ordered") return null;
      return { indent: p.indent.width, quote: p.quote.depth, p };
    };
    let seed = at(line);
    if (!seed && line > 1) seed = at(line - 1);
    if (!seed && line < doc.lines) seed = at(line + 1);
    if (!seed) return [];
    let start = line;
    while (start > 1) {
      const prev = at(start - 1);
      if (!prev || prev.indent !== seed.indent || prev.quote !== seed.quote) break;
      start -= 1;
    }
    let end = line;
    while (end < doc.lines) {
      const next = at(end + 1);
      if (!next || next.indent !== seed.indent || next.quote !== seed.quote) break;
      end += 1;
    }
    const changes = [];
    let n = 1;
    for (let i = start; i <= end; i++) {
      const row = at(i);
      if (!row) continue;
      const lineObj = doc.line(i);
      const marker = listMarkerText(row.p);
      const from = lineObj.from + row.p.quote.prefix.length + row.p.indent.raw.length;
      const to = from + marker.length;
      const insert = `${n}. `;
      if (marker !== insert) {
        changes.push({ from, to, insert });
      }
      n += 1;
    }
    return changes;
  }
  function renumberRunsNear(doc, parse, anchors) {
    const changes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const anchor of anchors) {
      for (const c of renumberList(doc, parse, anchor)) {
        const key = `${c.from}:${c.to}:${c.insert}`;
        if (seen.has(key)) continue;
        seen.add(key);
        changes.push(c);
      }
    }
    return changes;
  }
  function buildPosMapper(changes, originalLength) {
    const sorted = [...changes].sort((a, b) => a.from - b.from);
    const segments = [];
    let m = 0;
    let o = 0;
    for (const c of sorted) {
      if (c.from > o) {
        segments.push({ mStart: m, oStart: o, len: c.from - o, insert: false });
        m += c.from - o;
      }
      if (c.insert.length > 0) {
        segments.push({ mStart: m, oStart: c.from, len: c.insert.length, insert: true });
        m += c.insert.length;
      }
      o = c.to;
    }
    if (o < originalLength) {
      const len = originalLength - o;
      segments.push({ mStart: m, oStart: o, len, insert: false });
      m += len;
    }
    const deleted = sorted.filter((c) => c.to > c.from);
    const findSegment = (mPos) => {
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (mPos >= s.mStart && mPos < s.mStart + s.len) return i;
      }
      return -1;
    };
    return {
      forward: (pos) => {
        for (const c of deleted) {
          if (pos >= c.from && pos < c.to) return null;
        }
        for (const s of segments) {
          if (s.insert) continue;
          if (pos >= s.oStart && pos < s.oStart + s.len) return s.mStart + (pos - s.oStart);
        }
        return m;
      },
      backward: (pos) => {
        const i = findSegment(pos);
        if (i >= 0) {
          const s = segments[i];
          return s.insert ? "insert" : s.oStart + (pos - s.mStart);
        }
        const last = segments[segments.length - 1];
        return last ? last.insert ? "insert" : last.oStart + last.len : pos;
      }
    };
  }
  function stringDoc(text) {
    const parts = text.length === 0 ? [""] : text.split("\n");
    const starts = [0];
    for (let i = 0; i < parts.length - 1; i++) {
      starts.push(starts[i] + parts[i].length + 1);
    }
    const lineCount = parts.length;
    const line = (n) => {
      if (n < 1 || n > lineCount) {
        throw new Error(`stringDoc.line: ${n} not in 1..${lineCount}`);
      }
      const from = starts[n - 1];
      const to = n < lineCount ? starts[n] - 1 : text.length;
      return { text: text.slice(from, to), from, to };
    };
    return {
      lines: lineCount,
      length: text.length,
      line,
      lineAt: (pos) => {
        const p = Math.max(0, Math.min(text.length, pos));
        for (let i = lineCount; i >= 1; i--) {
          if (starts[i - 1] <= p) return { number: i };
        }
        return { number: 1 };
      },
      sliceString: (from, to) => text.slice(from, to)
    };
  }
  function captureMoveSource(doc, selection) {
    const ranges = selectionLineRanges(doc.lines, selection);
    if (ranges.length === 0) return null;
    const segments = ranges.map((range) => {
      const start = doc.line(range.startLine);
      const end = doc.line(range.endLine);
      const deleteRange = resolveDeleteRange(doc, start.from, end.to);
      return {
        lines: range,
        from: start.from,
        to: end.to,
        deleteFrom: deleteRange.from,
        deleteTo: deleteRange.to
      };
    });
    const content = segments.map((s) => doc.sliceString(s.from, s.to)).join("\n");
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    return {
      block: {
        type: selection.blocks[0].type,
        lines: { startLine: first.startLine, endLine: last.endLine }
      },
      payload: { content, ranges, segments }
    };
  }
  function moveTx(params) {
    const { sourceDoc, plan } = params;
    const targetDoc = plan.position.doc;
    const parse = (text) => parseLine(text, plan.tabSize);
    const insertText = insertTextForMove({
      doc: targetDoc,
      sourceBlock: plan.captured.block,
      targetLineNumber: plan.position.line,
      sourceContent: plan.captured.payload.content,
      position: plan.position,
      tabSize: plan.tabSize,
      indentUnit: plan.indentUnit
    });
    if (!insertText.length) return reject("no_insert_text");
    if (sourceDoc !== targetDoc) {
      const insert = geometryInsert(targetDoc, plan.position.line, insertText);
      const del = geometryDelete(plan.captured.payload);
      return [compileDocEdit(targetDoc, insert, parse), compileDocEdit(sourceDoc, del, parse)];
    }
    const geometry = geometrySameDoc({
      doc: targetDoc,
      payload: plan.captured.payload,
      targetLine: plan.position.line,
      insertText,
      allowInPlace: plan.allowIndent
    });
    if ("type" in geometry) return geometry;
    return [compileDocEdit(targetDoc, geometry, parse)];
  }
  function compileDocEdit(doc, geometry, parse) {
    if (geometry.length === 0) {
      return { doc, changes: [] };
    }
    const changes = sortChanges(geometry);
    const edited = stringDoc(applyChanges(doc, changes));
    const anchors = renumberAnchors(doc, changes, edited, parse);
    const renumber = renumberRunsNear(edited, parse, anchors);
    if (renumber.length === 0) {
      return { doc, changes };
    }
    return { doc, changes: composeOnOriginal(doc, changes, renumber) };
  }
  function renumberAnchors(doc, geometry, edited, parse) {
    const sorted = [...geometry].sort((a, b) => a.from - b.from);
    const mapper = buildPosMapper(sorted, doc.length);
    const anchors = /* @__PURE__ */ new Set();
    const addRow = (mPos) => {
      const p = Math.max(0, Math.min(edited.length, mPos));
      anchors.add(edited.lineAt(p).number);
    };
    for (const c of sorted) {
      if (c.insert.length > 0) {
        const start = c.from + editedDeltaBefore(sorted, c.from);
        const end = start + c.insert.length;
        const first = firstContentLine(c.insert);
        const last = lastContentLine(c.insert);
        if (start > 0 && isOrderedListItem(parse(first))) {
          const above = parse(lineTextAt(edited, start - 1));
          if (sameListRun(parse(first), above)) addRow(start - 1);
        }
        if (end < edited.length && isOrderedListItem(parse(last))) {
          const below = parse(lineTextAt(edited, end));
          if (sameListRun(parse(last), below)) addRow(end);
        }
      }
      if (c.to > c.from) {
        const after = mapper.forward(c.to);
        if (c.from > 0) {
          const before = mapper.forward(c.from - 1);
          if (before !== null) {
            const r1 = parse(lineTextAt(edited, before));
            const lastDeleted = parse(lineTextAt(doc, c.to - 1));
            if (isOrderedListItem(lastDeleted) && sameListRun(r1, lastDeleted)) addRow(before);
            if (after !== null && sameListRun(r1, parse(lineTextAt(edited, after)))) addRow(before);
          }
        }
        if (after !== null) {
          const r2 = parse(lineTextAt(edited, after));
          const firstDeleted = parse(lineTextAt(doc, c.from));
          if (isOrderedListItem(firstDeleted) && sameListRun(firstDeleted, r2)) addRow(after);
        }
      }
    }
    return [...anchors];
  }
  function lineTextAt(doc, pos) {
    return doc.line(doc.lineAt(pos).number).text;
  }
  function composeOnOriginal(doc, geometry, renumber) {
    var _a;
    const sorted = [...geometry].sort((a, b) => a.from - b.from);
    const mapper = buildPosMapper(sorted, doc.length);
    let insert = null;
    let insertStart = 0;
    let insertEnd = 0;
    for (const c of sorted) {
      if (c.insert.length > 0) {
        insert = c;
        insertStart = c.from + editedDeltaBefore(sorted, c.from);
        insertEnd = insert.from;
        break;
      }
    }
    let insertText = (_a = insert == null ? void 0 : insert.insert) != null ? _a : "";
    const mapped = [];
    for (const r of renumber) {
      const from = mapper.backward(r.from);
      const to = mapper.backward(r.to);
      if (insert && from === "insert" && to === "insert") {
        const offA = r.from - insertStart;
        const offB = r.to - insertStart;
        insertText = insertText.slice(0, offA) + r.insert + insertText.slice(offB);
      } else if (typeof from === "number" && typeof to === "number") {
        if (insert && insert.from === insert.to && from === insert.from) {
          insertText = insertText + r.insert;
          insertEnd = Math.max(insertEnd, to);
        } else {
          mapped.push({ from, to, insert: r.insert });
        }
      }
    }
    const out = [];
    for (const c of sorted) {
      if (c === insert) {
        out.push({ from: insert.from, to: insertEnd, insert: insertText });
      } else {
        out.push(c);
      }
    }
    return sortChanges([...out, ...mapped]);
  }
  function editedDeltaBefore(sorted, from) {
    let delta = 0;
    for (const c of sorted) {
      if (c.from >= from) break;
      delta += c.insert.length - (c.to - c.from);
    }
    return delta;
  }
  function firstContentLine(text) {
    for (const line of text.split("\n")) {
      if (line.trim().length > 0) return line;
    }
    return "";
  }
  function lastContentLine(text) {
    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) return lines[i];
    }
    return "";
  }
  function isOrderedListItem(p) {
    return isListLine(p) && listMarkerType(p) === "ordered";
  }
  function sameListRun(a, b) {
    return isListLine(a) && isListLine(b) && a.indent.width === b.indent.width && a.quote.depth === b.quote.depth;
  }
  function applyChanges(doc, changes) {
    let out = "";
    let pos = 0;
    for (const c of [...changes].sort((a, b) => a.from - b.from)) {
      out += doc.sliceString(pos, c.from) + c.insert;
      pos = c.to;
    }
    return out + doc.sliceString(pos, doc.length);
  }
  function geometryInsert(doc, targetLine, insertText) {
    const insertion = resolveInsertionChange(doc, targetLine, insertText, {
      lengthAfterDelete: doc.length
    });
    return [{ from: insertion.pos, to: insertion.pos, insert: insertion.text }];
  }
  function geometryDelete(payload) {
    return payload.segments.map((s) => ({
      from: s.deleteFrom,
      to: s.deleteTo,
      insert: ""
    }));
  }
  function geometrySameDoc(params) {
    const { doc, payload, targetLine, insertText, allowInPlace } = params;
    const deletedLen = payload.segments.reduce((sum, s) => sum + (s.deleteTo - s.deleteFrom), 0);
    const insertion = resolveInsertionChange(doc, targetLine, insertText, {
      lengthAfterDelete: doc.length - deletedLen
    });
    if (payload.segments.some((s) => insertion.pos > s.deleteFrom && insertion.pos < s.deleteTo)) {
      return reject("insertion_inside_deleted_range");
    }
    const first = payload.segments[0];
    if (allowInPlace && insertion.pos === first.deleteFrom) {
      return [
        {
          from: first.deleteFrom,
          to: first.deleteTo,
          insert: insertion.text
        }
      ];
    }
    return [{ from: insertion.pos, to: insertion.pos, insert: insertion.text }, ...geometryDelete(payload)];
  }
  function sortChanges(changes) {
    const key = (c) => `${c.from}:${c.to}:${c.insert}`;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const c of [...changes].sort((a, b) => b.from - a.from || b.to - a.to)) {
      const k = key(c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  }
  function planMove(input) {
    var _a, _b, _c;
    const targetDoc = input.position.doc;
    const captured = (_a = input.captured) != null ? _a : captureMoveSource(input.sourceDoc, input.selection);
    if (!captured) return { type: "reject", reason: "empty_selection" };
    const line = Math.max(1, Math.min(targetDoc.lines + 1, input.position.line));
    const position = {
      doc: targetDoc,
      line,
      parent: input.position.parent
    };
    const lineMap = getLineMap(targetDoc, { tabSize: input.tabSize });
    const slot = canDropAt(targetDoc, captured.block, line, {
      lineMap,
      tabSize: input.tabSize
    });
    if (!slot.decision.allowDrop) {
      return {
        type: "reject",
        reason: (_b = slot.decision.rejectReason) != null ? _b : "container_policy"
      };
    }
    let allowIndent = false;
    if (input.sourceDoc === targetDoc) {
      const parse = (text) => parseLine(text, input.tabSize);
      const self = selfDrop({
        doc: targetDoc,
        source: selectOne(captured.block),
        targetLineNumber: line,
        parseLineWithQuote: parse,
        lineMap,
        position,
        tabSize: input.tabSize,
        indentUnit: input.indentUnit
      });
      if (self.inSelfRange && !self.allowInPlaceIndentChange) {
        return {
          type: "reject",
          reason: (_c = self.rejectReason) != null ? _c : "self_range_blocked"
        };
      }
      allowIndent = self.allowInPlaceIndentChange;
    }
    return {
      type: "ok",
      value: {
        position,
        captured,
        allowIndent,
        tabSize: input.tabSize,
        indentUnit: input.indentUnit
      }
    };
  }
  function locateDropPosition(input) {
    var _a, _b;
    const { doc, selection, hitLine, belowMid, sourceIndentWidth, targetIndentWidth, tabSize, indentUnit } = input;
    const line = Math.max(1, Math.min(doc.lines + 1, belowMid ? hitLine + 1 : hitLine));
    if (indentUnit <= 0 || line <= 1) {
      return { doc, line, parent: null };
    }
    const want = Math.max(
      quantizeIndent(targetIndentWidth, indentUnit),
      quantizeIndent(sourceIndentWidth, indentUnit) - indentUnit
    );
    if (want <= 0) {
      return { doc, line, parent: null };
    }
    const lineMap = getLineMap(doc, { tabSize });
    const above = line - 1;
    let parentLine = listLineAtOrAbove(lineMap, above);
    if (parentLine === null || lineMap.listSubtreeEndLine[parentLine] < above) {
      return { doc, line, parent: null };
    }
    const desiredParentIndent = want - indentUnit;
    const sourceLines = selectionLineRanges(doc.lines, selection);
    while (parentLine > 0) {
      const meta = getLineMetaAt(lineMap, parentLine);
      if (!(meta == null ? void 0 : meta.isList)) {
        parentLine = 0;
        break;
      }
      if (isLineNumberInRanges(parentLine, sourceLines)) {
        parentLine = (_a = lineMap.listParentLine[parentLine]) != null ? _a : 0;
        continue;
      }
      if (meta.indentWidth > desiredParentIndent) {
        parentLine = (_b = lineMap.listParentLine[parentLine]) != null ? _b : 0;
        continue;
      }
      break;
    }
    if (parentLine <= 0) {
      return { doc, line, parent: null };
    }
    const parent = listItemAt(doc, parentLine, tabSize);
    return { doc, line, parent };
  }
  function quantizeIndent(width, indentUnit) {
    if (!(width > 0) || !(indentUnit > 0)) return 0;
    return Math.max(0, Math.round(width / indentUnit) * indentUnit);
  }
  function listItemAt(doc, listHeadLine, tabSize) {
    const block = detectBlock(doc, listHeadLine, { tabSize });
    if (!block || block.type !== "list-item") return null;
    return block;
  }
  function dropIndentWidth(position, options) {
    var _a, _b;
    if (((_a = position.parent) == null ? void 0 : _a.type) === "list-item") {
      const lineMap = getLineMap(position.doc, { tabSize: options.tabSize });
      const meta = getLineMetaAt(lineMap, position.parent.lines.startLine);
      const base = (_b = meta == null ? void 0 : meta.indentWidth) != null ? _b : 0;
      return base + options.indentUnit;
    }
    return 0;
  }
  function listLevel(lineText, tabSize, indentUnit) {
    var _a;
    const parsed = parseLine(lineText, tabSize);
    if (((_a = parsed.marker) == null ? void 0 : _a.kind) !== "list" || parsed.quote.prefix.length > 0) return 0;
    return Math.round(parsed.indent.width / indentUnit);
  }
  var NO_SNAP_REASONS = /* @__PURE__ */ new Set(["self_range_blocked", "self_embedding"]);
  var SNAP_RADIUS = 4;
  function snapDrop(input) {
    const { raw, sourceDoc, selection, sourceIndentWidth, targetIndentWidth, tabSize, indentUnit } = input;
    const doc = raw.doc;
    const seam = raw.line;
    const maxLine = doc.lines + 1;
    const plan = (position) => planMove({ sourceDoc, selection, position, tabSize, indentUnit });
    const rawPlan = plan(raw);
    if (rawPlan.type === "ok" || NO_SNAP_REASONS.has(rawPlan.reason)) return raw;
    const candidates = [];
    const push = (line) => {
      if (line < 1 || line > maxLine || candidates.includes(line)) return;
      candidates.push(line);
    };
    for (const probe of [seam, seam - 1]) {
      const block = detectBlock(doc, probe, { tabSize });
      if (!block) continue;
      push(block.lines.startLine);
      push(block.lines.endLine + 1);
    }
    for (let d = 1; d <= SNAP_RADIUS; d++) {
      push(seam - d);
      push(seam + d);
    }
    const byDistance = [...candidates].sort((a, b) => Math.abs(a - seam) - Math.abs(b - seam) || b - a);
    for (const line of byDistance) {
      const position = locateDropPosition({
        doc,
        selection,
        hitLine: line,
        belowMid: false,
        sourceIndentWidth,
        targetIndentWidth,
        tabSize,
        indentUnit
      });
      const planned = plan(position);
      if (planned.type === "ok" || NO_SNAP_REASONS.has(planned.reason)) return position;
    }
    return raw;
  }
  function selectionFromOutputs(outputs) {
    let selection = null;
    for (const output of outputs) {
      if (output.type === "selection_changed" || output.type === "drag_source_changed" || output.type === "drag_over") {
        selection = output.selection;
      } else if (output.type === "cancelled" || output.type === "terminal" || output.type === "dropped") {
        selection = null;
      }
    }
    return selection;
  }
  function dropSeamState(outputs, doc) {
    let position = null;
    let invalid = false;
    for (const output of outputs) {
      if (output.type === "drag_over") {
        const onView = output.drop.position && output.drop.position.doc === doc ? output.drop.position : null;
        position = onView;
        invalid = onView !== null && output.drop.rejectReason != null;
      } else if (output.type === "dropped" || output.type === "cancelled" || output.type === "terminal") {
        position = null;
      }
    }
    return { position, invalid };
  }
  function samePointer(a, b) {
    return a.id === b.id;
  }
  function isPromiseLike(value) {
    return value !== void 0 && typeof value.then === "function";
  }
  var DEFAULT_GESTURE_CONFIG = {
    dragArmMs: 0,
    multiSelectMs: 500,
    dragStartMoveThresholdPx: 4,
    dragCancelMoveThresholdPx: 12,
    multiSelectEnabled: false
  };
  function notifyModules(modules, hook, ctx, result) {
    var _a, _b, _c, _d;
    for (const module of modules) {
      if (hook === "onDragEnd") {
        (_a = module.onDragEnd) == null ? void 0 : _a.call(module, ctx, result);
        continue;
      }
      if (hook === "onDragStart") (_b = module.onDragStart) == null ? void 0 : _b.call(module, ctx);
      else if (hook === "onDragMove") (_c = module.onDragMove) == null ? void 0 : _c.call(module, ctx);
      else if (hook === "onCancel") (_d = module.onCancel) == null ? void 0 : _d.call(module, ctx);
    }
  }
  var DefaultUx = class {
    constructor(deps) {
      this.deps = deps;
      this.disposables = [];
      this.pressSession = null;
      this.destroyed = false;
      var _a;
      this.modules = (_a = deps.modules) != null ? _a : [];
    }
    mount() {
      const input = this.deps.input;
      this.disposables.push(input.onPress((e) => this.handlePress(e)));
      this.disposables.push(input.onMove((e) => this.handleMove(e)));
      this.disposables.push(input.onRelease((e) => this.handleRelease(e)));
      if (input.onCancel) {
        this.disposables.push(input.onCancel((e) => this.handleCancel(e.pointer, e.releaseCapture)));
      }
      if (input.onEscape) {
        this.disposables.push(input.onEscape(() => this.runtime().clearSelectionOrCancel("keyboard_escape")));
      }
    }
    destroy() {
      var _a, _b, _c;
      this.destroyed = true;
      this.clearTimers();
      (_b = (_a = this.pressSession) == null ? void 0 : _a.releaseCapture) == null ? void 0 : _b.call(_a);
      this.pressSession = null;
      for (const module of this.modules) (_c = module.destroy) == null ? void 0 : _c.call(module);
      for (const dispose of this.disposables) dispose();
      this.disposables.length = 0;
    }
    runtime() {
      return this.deps.runtime;
    }
    cfg() {
      return this.deps.gestureConfig();
    }
    handlePress(input) {
      var _a, _b, _c;
      if (input.button !== void 0 && input.button !== 0) return;
      if (this.runtime().isCommitPending()) return;
      const lineNumber = this.deps.sourceLineFromInput(input);
      if (lineNumber === null) {
        this.runtime().clearSelectionOrCancel();
        return;
      }
      const block = detectBlock(this.deps.getDoc(), lineNumber, { tabSize: this.deps.tabSize });
      if (!block) return;
      if (this.runtime().isGestureActive()) {
        this.cancelPress("session_interrupted", input.pointer.type);
      } else {
        this.clearPress();
      }
      const cfg = this.cfg();
      const sessionId = this.runtime().createSessionId();
      const suppliedSelection = (_c = (_b = (_a = this.deps).selectionFromInput) == null ? void 0 : _b.call(_a, input, block)) != null ? _c : null;
      const usesSuppliedSelection = suppliedSelection !== null && suppliedSelection.blocks.length > 0;
      const selection = usesSuppliedSelection ? suppliedSelection : selectOne(block);
      const existing = this.currentSelection();
      const inSelecting = !usesSuppliedSelection && cfg.multiSelectEnabled && this.runtime().state.type === "selecting";
      const selectedDragCandidate = inSelecting && existing !== null && hasBlock(existing, block);
      if (inSelecting) {
        const groupArmMs = Math.max(cfg.dragArmMs, cfg.multiSelectMs);
        if (selectedDragCandidate) {
          const timer = groupArmMs > 0 ? this.deps.scheduler.setTimer(
            () => this.markSelectedDragReady(sessionId, input.pointer),
            groupArmMs
          ) : null;
          this.pressSession = this.makeSession({
            sessionId,
            pointer: input.pointer,
            start: input.point,
            anchorBlock: block,
            selection: existing,
            baseSelection: existing,
            ready: false,
            selectedDragCandidate: true,
            selectedDragReady: groupArmMs <= 0,
            armTimer: timer,
            multiSelectTimer: null,
            releaseCapture: input.releaseCapture
          });
          return;
        }
        this.pressSession = this.makeSession({
          sessionId,
          pointer: input.pointer,
          start: input.point,
          anchorBlock: block,
          selection: existing != null ? existing : selection,
          baseSelection: existing != null ? existing : { blocks: [] },
          ready: false,
          selectedDragCandidate: false,
          selectedDragReady: false,
          armTimer: null,
          multiSelectTimer: null,
          releaseCapture: input.releaseCapture
        });
        this.startToggleSweep(this.pressSession);
        return;
      }
      this.runtime().beginHold(sessionId, selection, input.pointer.type);
      if (cfg.multiSelectEnabled && !usesSuppliedSelection) {
        const multiMs = Math.max(0, cfg.multiSelectMs);
        const armMs2 = Math.max(0, cfg.dragArmMs);
        const multiSelectTimer = multiMs > 0 ? this.deps.scheduler.setTimer(
          () => this.startRangeSweepIfCurrent(sessionId, input.pointer),
          multiMs
        ) : null;
        const armTimer2 = armMs2 > 0 ? this.deps.scheduler.setTimer(() => this.markReady(sessionId, input.pointer), armMs2) : null;
        this.pressSession = this.makeSession({
          sessionId,
          pointer: input.pointer,
          start: input.point,
          anchorBlock: block,
          selection,
          baseSelection: { blocks: [] },
          ready: armMs2 <= 0,
          selectedDragCandidate: false,
          selectedDragReady: false,
          armTimer: armTimer2,
          multiSelectTimer,
          releaseCapture: input.releaseCapture
        });
        if (armMs2 <= 0) this.runtime().markHoldReady(sessionId, input.pointer.type);
        if (multiMs <= 0) this.startRangeSweep(this.pressSession);
        return;
      }
      const armMs = Math.max(0, cfg.dragArmMs);
      const armTimer = armMs > 0 ? this.deps.scheduler.setTimer(() => this.markReady(sessionId, input.pointer), armMs) : null;
      this.pressSession = this.makeSession({
        sessionId,
        pointer: input.pointer,
        start: input.point,
        anchorBlock: block,
        selection,
        baseSelection: { blocks: [] },
        ready: armMs <= 0,
        selectedDragCandidate: false,
        selectedDragReady: false,
        armTimer,
        multiSelectTimer: null,
        releaseCapture: input.releaseCapture
      });
      if (armMs <= 0) this.markReady(sessionId, input.pointer);
    }
    handleMove(input) {
      var _a, _b;
      const session = this.pressSession;
      if (!session || !samePointer(session.pointer, input.pointer)) return;
      if (input.buttons === 0) {
        this.handleCancel(input.pointer);
        return;
      }
      if (this.runtime().isGestureActive()) {
        this.runtime().moveDrag(session.sessionId, input.point, input.pointer, input.pointer.type);
        this.emitModule("onDragMove", session, input.point, input.pointer);
        return;
      }
      const distance = distanceBetween(session.start, input.point);
      const cfg = this.cfg();
      if (session.selectedDragReady) {
        if (distance < cfg.dragStartMoveThresholdPx) return;
        const state = this.runtime().state;
        if (state.type !== "selecting" || state.selection.selection.blocks.length === 0) return;
        (_a = input.claim) == null ? void 0 : _a.call(input);
        this.clearTimers();
        this.startDrag(session, state.selection.selection, input.point, input.pointer);
        return;
      }
      if (session.selectedDragCandidate && !session.toggleSweep && !session.rangeActive) {
        if (distance < cfg.dragStartMoveThresholdPx) return;
        this.startToggleSweep(session);
      }
      if (session.toggleSweep) {
        this.updateToggleSelection(session, input.point);
        return;
      }
      if (session.rangeActive) {
        this.updateRangeSelection(session, input.point);
        return;
      }
      if (!session.ready) {
        if (distance > cfg.dragCancelMoveThresholdPx) {
          this.cancelPress("press_cancelled", input.pointer.type);
        }
        return;
      }
      if (distance < cfg.dragStartMoveThresholdPx) return;
      (_b = input.claim) == null ? void 0 : _b.call(input);
      this.clearTimers();
      if (this.runtime().state.type === "holding") {
        this.runtime().markHoldReady(session.sessionId, input.pointer.type);
      }
      this.startDrag(session, session.selection, input.point, input.pointer);
    }
    handleRelease(input) {
      const session = this.pressSession;
      if (this.runtime().isGestureActive() && session && samePointer(session.pointer, input.pointer)) {
        const result = this.runtime().commitDrop(session.sessionId, input.point, input.pointer, input.pointer.type);
        if (isPromiseLike(result)) {
          void result.then((resolved) => {
            if (this.destroyed) return;
            this.emitModule("onDragEnd", session, input.point, input.pointer, resolved);
          });
        } else {
          this.emitModule("onDragEnd", session, input.point, input.pointer, result != null ? result : { kind: "rejected" });
        }
        this.pressSession = null;
        return;
      }
      if (!(session && samePointer(session.pointer, input.pointer))) return;
      if (session.rangeActive || session.toggleSweep) {
        this.clearPress();
        return;
      }
      if (session.selectedDragCandidate && !session.selectedDragReady) {
        const next = removeBlocks(session.baseSelection, [session.anchorBlock]);
        if (next.blocks.length === 0) this.runtime().clearSelection();
        else this.runtime().setSelection(next);
        this.clearPress();
        return;
      }
      if (session.selectedDragCandidate) {
        this.clearPress();
        return;
      }
      this.cancelPress("press_cancelled", input.pointer.type);
    }
    handleCancel(pointer, releaseCapture) {
      const session = this.pressSession;
      releaseCapture == null ? void 0 : releaseCapture();
      if (this.runtime().isGestureActive()) {
        if (session) {
          this.emitModule("onCancel", session, session.start, pointer);
        }
        this.runtime().cancel("pointer_cancelled", pointer.type);
        this.pressSession = null;
      } else if (session && samePointer(session.pointer, pointer)) {
        this.cancelPress("pointer_cancelled", pointer.type);
      }
    }
    startDrag(session, selection, point, pointer) {
      session.selection = selection;
      session.dragActive = true;
      this.runtime().beginDrag(session.sessionId, selection, point, pointer, pointer.type, session.releaseCapture);
      session.releaseCapture = void 0;
      this.emitModule("onDragStart", session, point, pointer);
    }
    emitModule(hook, session, point, pointer, result) {
      if (this.modules.length === 0) return;
      const ctx = {
        selection: session.selection,
        point,
        pointer
      };
      notifyModules(this.modules, hook, ctx, result);
    }
    markReady(sessionId, pointer) {
      const session = this.pressSession;
      if (!session || session.sessionId !== sessionId || !samePointer(session.pointer, pointer)) return;
      session.ready = true;
      if (session.armTimer !== null) {
        this.deps.scheduler.clearTimer(session.armTimer);
        session.armTimer = null;
      }
      this.runtime().markHoldReady(sessionId, pointer.type);
    }
    markSelectedDragReady(sessionId, pointer) {
      const session = this.pressSession;
      if (!session || session.sessionId !== sessionId || !samePointer(session.pointer, pointer)) return;
      if (!session.selectedDragCandidate) return;
      if (session.armTimer !== null) {
        this.deps.scheduler.clearTimer(session.armTimer);
        session.armTimer = null;
      }
      session.selectedDragReady = true;
    }
    startRangeSweepIfCurrent(sessionId, pointer) {
      const session = this.pressSession;
      if (!session || session.sessionId !== sessionId || !samePointer(session.pointer, pointer)) return;
      this.startRangeSweep(session);
    }
    startRangeSweep(session) {
      if (session.rangeActive || session.toggleSweep) return;
      this.clearTimers();
      session.rangeActive = true;
      session.selectedDragReady = false;
      session.ready = false;
      if (this.runtime().state.type === "holding" || this.runtime().state.type === "ready_to_drag") {
        this.runtime().cancel("session_interrupted", session.pointer.type);
      }
      this.runtime().setSelection(selectOne(session.anchorBlock));
      session.selection = selectOne(session.anchorBlock);
      session.baseSelection = { blocks: [] };
    }
    startToggleSweep(session) {
      if (session.toggleSweep || session.rangeActive) return;
      this.clearTimers();
      session.toggleSweep = true;
      session.selectedDragCandidate = false;
      session.selectedDragReady = false;
      session.ready = false;
      this.applyToggleRange(session, session.anchorBlock);
    }
    updateToggleSelection(session, point) {
      const lineNumber = this.deps.lineFromPoint(point);
      if (lineNumber === null) return;
      const focus = detectBlock(this.deps.getDoc(), lineNumber, { tabSize: this.deps.tabSize });
      if (!focus) return;
      this.applyToggleRange(session, focus);
    }
    applyToggleRange(session, focus) {
      const range = blocksBetween(this.deps.getDoc(), this.deps.tabSize, session.anchorBlock, focus);
      const next = xorSelection(session.baseSelection, range);
      session.selection = next;
      if (next.blocks.length === 0) this.runtime().clearSelection();
      else this.runtime().setSelection(next);
    }
    updateRangeSelection(session, point) {
      const lineNumber = this.deps.lineFromPoint(point);
      if (lineNumber === null) return;
      const doc = this.deps.getDoc();
      const focus = detectBlock(doc, lineNumber, { tabSize: this.deps.tabSize });
      if (!focus) return;
      const blocks = blocksBetween(doc, this.deps.tabSize, session.anchorBlock, focus);
      const selection = selectBlocks(blocks);
      session.selection = selection;
      this.runtime().setSelection(selection);
    }
    currentSelection() {
      const state = this.runtime().state;
      if (state.type !== "selecting") return null;
      return state.selection.selection;
    }
    cancelPress(reason, pointerType) {
      const session = this.pressSession;
      if (session == null ? void 0 : session.dragActive) {
        this.emitModule("onCancel", session, session.start, session.pointer);
      }
      this.clearPress();
      this.runtime().cancel(reason, pointerType);
    }
    clearPress() {
      var _a, _b;
      if (!this.pressSession) return;
      this.clearTimers();
      (_b = (_a = this.pressSession).releaseCapture) == null ? void 0 : _b.call(_a);
      this.pressSession = null;
    }
    /** One press-session shape for every branch — only the differing fields
     * are passed; the shared defaults (no range/toggle sweep yet, not an
     * active drag) live here. */
    makeSession(params) {
      return {
        ...params,
        rangeActive: false,
        toggleSweep: false,
        dragActive: false
      };
    }
    clearTimers() {
      const session = this.pressSession;
      if (!session) return;
      if (session.armTimer !== null) {
        this.deps.scheduler.clearTimer(session.armTimer);
        session.armTimer = null;
      }
      if (session.multiSelectTimer !== null) {
        this.deps.scheduler.clearTimer(session.multiSelectTimer);
        session.multiSelectTimer = null;
      }
    }
  };
  function distanceBetween(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  function blocksBetween(doc, tabSize, anchor, focus) {
    const start = Math.min(anchor.lines.startLine, focus.lines.startLine);
    const end = Math.max(anchor.lines.endLine, focus.lines.endLine);
    const blocks = [];
    let cursor = start;
    while (cursor <= end) {
      const block = detectBlock(doc, cursor, { tabSize });
      if (!block) {
        cursor += 1;
        continue;
      }
      blocks.push(block);
      cursor = block.lines.endLine + 1;
    }
    return blocks;
  }
  function xorSelection(base, range) {
    let next = base;
    for (const block of range) {
      next = hasBlock(next, block) ? removeBlocks(next, [block]) : addBlocks(next, [block]);
    }
    return next;
  }
  var IDLE_PIPELINE_STATE = { type: "idle" };
  var DragPipeline = class {
    constructor(options = {}) {
      this.options = options;
      this.currentState = IDLE_PIPELINE_STATE;
    }
    get state() {
      return this.currentState;
    }
    enter(event) {
      var _a, _b;
      const previous = this.currentState;
      const transition = transitionPipelineState(previous, event);
      this.currentState = transition.state;
      const output = {
        outputs: this.decorateOutputs(previous, this.currentState, event, transition.outputs)
      };
      (_b = (_a = this.options).onChange) == null ? void 0 : _b.call(_a, output);
      return output;
    }
    clear() {
      return this.enter({ type: "destroy" });
    }
    decorateOutputs(previous, current, event, outputs) {
      const decorated = [...outputs];
      if (shouldClearSelectionVisual(previous, current) && !hasSelectionClearOutput(decorated)) {
        decorated.push({ type: "selection_changed", selection: null });
      }
      if (previous.type !== "dragging" && current.type === "dragging") {
        decorated.push({
          type: "drag_source_changed",
          selection: current.drag.selection,
          sourceDoc: current.drag.sourceDoc
        });
      }
      if (previous.type === "dragging" && current.type !== "dragging" && current.type !== "idle") {
        decorated.push({ type: "drag_source_changed", selection: null, sourceDoc: null });
      }
      if (previous.type !== "idle" && current.type === "idle") {
        decorated.push({ type: "drag_source_changed", selection: null, sourceDoc: null });
      }
      const terminalReason = resolveTerminalReason(previous, current, event);
      if (terminalReason) {
        decorated.push({ type: "terminal", reason: terminalReason });
      }
      return decorated;
    }
  };
  function shouldClearSelectionVisual(previous, current) {
    return previous.type === "selecting" && current.type !== "selecting";
  }
  function hasSelectionClearOutput(outputs) {
    return outputs.some((output) => output.type === "selection_changed" && output.selection === null);
  }
  function resolveTerminalReason(previous, current, event) {
    if (previous.type === "idle" || current.type !== "idle") return null;
    switch (event.type) {
      case "drop":
        return "drop";
      case "cancel":
        return "cancel";
      case "destroy":
        return "destroy";
      default:
        return null;
    }
  }
  function transitionPipelineState(state, event) {
    var _a;
    switch (event.type) {
      case "hold_start":
        return onHoldStart(state, event);
      case "hold_ready":
        return onHoldReady(state, event);
      case "selection_set":
        return onSelectionSet(state, event);
      case "selection_clear":
        return clearSelection(state);
      case "drag_start":
        return onDragStart(state, event);
      case "drag_over":
        return onDragOver(state, event);
      case "drop":
        return onDrop(state, event);
      case "cancel":
        return cancelPipeline(state, event.reason, (_a = event.pointerType) != null ? _a : null);
      case "destroy":
        return destroyPipeline();
    }
  }
  function onHoldStart(_state, event) {
    const next = {
      type: "holding",
      hold: {
        sessionId: event.sessionId,
        selection: event.selection
      }
    };
    return {
      state: next,
      outputs: [{ type: "state_changed", state: next }]
    };
  }
  function onHoldReady(state, event) {
    if (state.type !== "holding" || state.hold.sessionId !== event.sessionId) {
      return { state, outputs: [] };
    }
    const next = {
      type: "ready_to_drag",
      hold: state.hold
    };
    return {
      state: next,
      outputs: [{ type: "state_changed", state: next }]
    };
  }
  function onSelectionSet(_state, event) {
    const next = {
      type: "selecting",
      selection: {
        selection: event.selection
      }
    };
    return {
      state: next,
      outputs: [
        { type: "state_changed", state: next },
        { type: "selection_changed", selection: event.selection }
      ]
    };
  }
  function dragSourceFrom(state) {
    switch (state.type) {
      case "ready_to_drag":
        return state.hold.selection;
      case "selecting":
        return state.selection.selection;
      default:
        return null;
    }
  }
  function onDragStart(state, event) {
    var _a;
    if (state.type !== "ready_to_drag" && state.type !== "selecting") {
      return { state, outputs: [] };
    }
    const source = dragSourceFrom(state);
    if (source === null) {
      return { state, outputs: [] };
    }
    const sessionId = state.type === "ready_to_drag" ? state.hold.sessionId : event.sessionId;
    if (sessionId !== event.sessionId) {
      return { state, outputs: [] };
    }
    const next = {
      type: "dragging",
      drag: {
        sessionId: event.sessionId,
        selection: source,
        drop: event.drop,
        sourceDoc: event.sourceDoc
      }
    };
    return {
      state: next,
      outputs: [
        { type: "state_changed", state: next },
        ...dragOver({
          selection: next.drag.selection,
          drop: event.drop,
          sourceDoc: next.drag.sourceDoc,
          pointerType: (_a = event.pointerType) != null ? _a : null
        })
      ]
    };
  }
  function onDragOver(state, event) {
    var _a;
    if (state.type !== "dragging" || state.drag.sessionId !== event.sessionId) {
      return { state, outputs: [] };
    }
    const next = {
      type: "dragging",
      drag: {
        ...state.drag,
        drop: event.drop
      }
    };
    return {
      state: next,
      outputs: [
        { type: "state_changed", state: next },
        ...dragOver({
          selection: next.drag.selection,
          drop: event.drop,
          sourceDoc: next.drag.sourceDoc,
          pointerType: (_a = event.pointerType) != null ? _a : null
        })
      ]
    };
  }
  function onDrop(state, event) {
    var _a;
    if (state.type !== "dragging" || state.drag.sessionId !== event.sessionId) {
      return { state, outputs: [] };
    }
    return {
      state: IDLE_PIPELINE_STATE,
      outputs: [
        { type: "state_changed", state: IDLE_PIPELINE_STATE },
        ...drop({
          selection: state.drag.selection,
          resolution: event.resolution,
          pointerType: (_a = event.pointerType) != null ? _a : null
        })
      ]
    };
  }
  function dragOver(params) {
    return [
      {
        type: "drag_over",
        selection: params.selection,
        drop: params.drop,
        sourceDoc: params.sourceDoc,
        pointerType: params.pointerType
      }
    ];
  }
  function drop(params) {
    var _a, _b;
    if (params.resolution.type === "cancel") {
      return cancelDrop({
        selection: params.selection,
        reason: (_b = (_a = params.resolution.reason) != null ? _a : params.resolution.drop.rejectReason) != null ? _b : "no_target",
        pointerType: params.pointerType
      });
    }
    return [
      {
        type: "dropped",
        selection: params.selection,
        drop: params.resolution.drop,
        pointerType: params.pointerType
      }
    ];
  }
  function cancelDrop(params) {
    return [
      {
        type: "cancelled",
        selection: params.selection,
        reason: params.reason,
        pointerType: params.pointerType
      }
    ];
  }
  function cancelPipeline(state, reason, pointerType) {
    if (state.type === "idle") {
      return { state, outputs: [] };
    }
    const source = state.type === "holding" || state.type === "ready_to_drag" ? state.hold.selection : state.type === "selecting" ? state.selection.selection : state.drag.selection;
    return {
      state: IDLE_PIPELINE_STATE,
      outputs: [
        { type: "state_changed", state: IDLE_PIPELINE_STATE },
        ...cancelDrop({
          selection: source,
          reason,
          pointerType
        })
      ]
    };
  }
  function clearSelection(state) {
    if (state.type !== "selecting") {
      return { state, outputs: [] };
    }
    return {
      state: IDLE_PIPELINE_STATE,
      outputs: [
        { type: "selection_changed", selection: null },
        { type: "state_changed", state: IDLE_PIPELINE_STATE }
      ]
    };
  }
  function destroyPipeline() {
    return {
      state: IDLE_PIPELINE_STATE,
      outputs: [{ type: "state_changed", state: IDLE_PIPELINE_STATE }]
    };
  }
  var DraggerRuntime = class {
    constructor(options) {
      this.options = options;
      this.activeDragSession = null;
      this.mounted = false;
      this.nextSessionNumber = 1;
      this.ux = null;
      this.pendingCommitSessionId = null;
      this.pipeline = new DragPipeline({
        onChange: (result) => {
          var _a, _b;
          return (_b = (_a = this.options).onChange) == null ? void 0 : _b.call(_a, result);
        }
      });
    }
    get state() {
      return this.pipeline.state;
    }
    mount() {
      if (this.mounted) return;
      this.mounted = true;
      this.ux = this.buildUx();
      this.ux.mount();
    }
    destroy() {
      var _a;
      (_a = this.ux) == null ? void 0 : _a.destroy();
      this.ux = null;
      this.pendingCommitSessionId = null;
      this.endDragSession();
      this.pipeline.clear();
      this.mounted = false;
    }
    isGestureActive() {
      return this.pipeline.state.type === "dragging";
    }
    isCommitPending() {
      return this.pendingCommitSessionId !== null;
    }
    createSessionId() {
      const sessionId = `runtime-${this.nextSessionNumber}`;
      this.nextSessionNumber += 1;
      return sessionId;
    }
    beginHold(sessionId, selection, pointerType) {
      if (this.isCommitPending()) return;
      this.pipeline.enter({ type: "hold_start", sessionId, selection, pointerType });
    }
    markHoldReady(sessionId, pointerType) {
      if (this.pipeline.state.type !== "holding") return;
      if (this.pipeline.state.hold.sessionId !== sessionId) return;
      this.pipeline.enter({ type: "hold_ready", sessionId, pointerType });
    }
    beginDrag(sessionId, selection, point, pointer, pointerType, releaseCapture) {
      if (this.isCommitPending()) return;
      this.endDragSession();
      const position = this.resolvePosition(point, selection);
      this.activeDragSession = { sessionId, pointer, selection, position, releaseCapture };
      this.pipeline.enter({
        type: "drag_start",
        sessionId,
        drop: this.buildDropSnapshot(selection, position),
        sourceDoc: this.options.document.getDoc(),
        pointerType
      });
    }
    moveDrag(sessionId, point, pointer, pointerType) {
      const drag = this.activeDragSession;
      if (!drag || drag.sessionId !== sessionId || !samePointer(drag.pointer, pointer)) return;
      drag.position = this.resolvePosition(point, drag.selection);
      this.pipeline.enter({
        type: "drag_over",
        sessionId: drag.sessionId,
        drop: this.buildDropSnapshot(drag.selection, drag.position),
        pointerType
      });
    }
    commitDrop(sessionId, point, pointer, pointerType) {
      var _a, _b, _c;
      if (this.isCommitPending()) return;
      const drag = this.activeDragSession;
      if (!drag || drag.sessionId !== sessionId || !samePointer(drag.pointer, pointer)) return;
      drag.position = this.resolvePosition(point, drag.selection);
      const dropSnapshot = this.buildDropSnapshot(drag.selection, drag.position);
      const planned = this.plan(drag.selection, drag.position);
      if (planned.type !== "ok" || !drag.position) {
        this.pipeline.enter({
          type: "drop",
          sessionId: drag.sessionId,
          resolution: this.cancelDrop(dropSnapshot, planned.type === "ok" ? "no_target" : planned.reason),
          pointerType
        });
        this.endDragSession();
        return { kind: "rejected" };
      }
      const edits = moveTx({ sourceDoc: this.options.document.getDoc(), plan: planned.value });
      if (!Array.isArray(edits)) {
        this.pipeline.enter({
          type: "drop",
          sessionId: drag.sessionId,
          resolution: this.cancelDrop(dropSnapshot, edits.reason),
          pointerType
        });
        this.endDragSession();
        return { kind: "rejected" };
      }
      const plannedEdits = edits;
      try {
        const application = (_b = (_a = this.options.commit).apply) == null ? void 0 : _b.call(_a, plannedEdits);
        if (isPromiseLike(application)) {
          this.pendingCommitSessionId = drag.sessionId;
          (_c = drag.releaseCapture) == null ? void 0 : _c.call(drag);
          drag.releaseCapture = void 0;
          return application.then(
            () => this.finishDrop(drag.sessionId, dropSnapshot, pointerType, {
              kind: "applied",
              edits: plannedEdits
            }),
            () => this.finishDrop(drag.sessionId, dropSnapshot, pointerType, { kind: "rejected" })
          );
        }
        return this.finishDrop(drag.sessionId, dropSnapshot, pointerType, { kind: "applied", edits: plannedEdits });
      } catch (e) {
        return this.finishDrop(drag.sessionId, dropSnapshot, pointerType, { kind: "rejected" });
      }
    }
    setSelection(selection) {
      this.pipeline.enter({ type: "selection_set", selection });
    }
    clearSelection() {
      this.pipeline.enter({ type: "selection_clear" });
    }
    cancel(reason = "press_cancelled", pointerType = null) {
      if (this.isCommitPending()) return;
      this.endDragSession();
      this.pipeline.enter({ type: "cancel", reason, pointerType });
    }
    clearSelectionOrCancel(reason = "press_cancelled") {
      if (this.isCommitPending()) return true;
      if (!this.isGestureActive() && this.pipeline.state.type === "selecting") {
        this.clearSelection();
        return true;
      }
      if (this.pipeline.state.type === "idle") return false;
      this.cancel(reason);
      return true;
    }
    buildUx() {
      var _a, _b, _c;
      if (typeof this.options.ux === "function") return this.options.ux(this);
      const uxConfig = (_a = this.options.ux) != null ? _a : {};
      const scheduler = (_b = this.options.scheduler) != null ? _b : {
        setTimer: (cb, ms) => setTimeout(cb, ms),
        clearTimer: (token) => clearTimeout(token)
      };
      return new DefaultUx({
        input: this.options.input,
        runtime: this,
        getDoc: () => this.options.document.getDoc(),
        sourceLineFromInput: (input) => this.options.locate.sourceLineFromInput(input),
        lineFromPoint: (point) => {
          var _a2, _b2, _c2;
          return (_c2 = (_b2 = (_a2 = this.options.locate).lineFromPoint) == null ? void 0 : _b2.call(_a2, point)) != null ? _c2 : null;
        },
        tabSize: this.config().tabSize,
        gestureConfig: () => this.resolveGestureConfig(uxConfig),
        selectionFromInput: uxConfig.selectionFromInput,
        scheduler,
        modules: (_c = uxConfig.modules) != null ? _c : []
      });
    }
    finishDrop(sessionId, drop2, pointerType, result) {
      var _a;
      if (((_a = this.activeDragSession) == null ? void 0 : _a.sessionId) !== sessionId) return { kind: "rejected" };
      this.pendingCommitSessionId = null;
      this.pipeline.enter({
        type: "drop",
        sessionId,
        resolution: result.kind === "applied" ? { type: "platform_commit", drop: drop2 } : this.cancelDrop(drop2, "commit_failed"),
        pointerType
      });
      this.endDragSession();
      return result;
    }
    resolveGestureConfig(uxConfig) {
      const raw = typeof uxConfig.gesture === "function" ? uxConfig.gesture() : uxConfig.gesture;
      return { ...DEFAULT_GESTURE_CONFIG, ...raw };
    }
    endDragSession() {
      var _a, _b;
      (_b = (_a = this.activeDragSession) == null ? void 0 : _a.releaseCapture) == null ? void 0 : _b.call(_a);
      this.activeDragSession = null;
    }
    resolvePosition(point, selection) {
      const position = this.options.locate.resolveDropPosition(point, { selection });
      if (!position) return null;
      const doc = position.doc;
      const line = Math.max(1, Math.min(doc.lines + 1, position.line));
      return {
        doc,
        line,
        parent: position.parent
      };
    }
    plan(selection, position) {
      if (position === null) return { type: "reject", reason: "no_target" };
      const { tabSize, listIndentUnit } = this.config();
      return planMove({
        sourceDoc: this.options.document.getDoc(),
        selection,
        position,
        tabSize,
        indentUnit: listIndentUnit
      });
    }
    buildDropSnapshot(selection, position) {
      return {
        position,
        rejectReason: position === null ? "no_target" : this.dropRejectReason(selection, position)
      };
    }
    dropRejectReason(selection, position) {
      const planned = this.plan(selection, position);
      if (planned.type === "ok") return null;
      return isDragCancelReason(planned.reason) ? planned.reason : "selection_invalid";
    }
    cancelDrop(drop2, reason) {
      return {
        type: "cancel",
        drop: drop2,
        reason: isDragCancelReason(reason) ? reason : "selection_invalid"
      };
    }
    config() {
      const raw = typeof this.options.config === "function" ? this.options.config() : this.options.config;
      if (!raw) {
        throw new Error("DraggerRuntime: config is required (tabSize, listIndentUnit)");
      }
      if (!(raw.tabSize > 0)) {
        throw new Error(`DraggerRuntime: config.tabSize must be positive, got ${String(raw.tabSize)}`);
      }
      if (!(raw.listIndentUnit > 0)) {
        throw new Error(
          `DraggerRuntime: config.listIndentUnit must be positive, got ${String(raw.listIndentUnit)}`
        );
      }
      return raw;
    }
  };
  function isDragCancelReason(reason) {
    return reason !== "empty_selection";
  }
  function applyCommit(editor, edits) {
    const model = editor.getModel();
    if (!model) return;
    for (const edit of edits) {
      if (edit.changes.length === 0) continue;
      const operations = edit.changes.map((change) => {
        const start = model.getPositionAt(change.from);
        const end = model.getPositionAt(change.to);
        return {
          range: {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column
          },
          text: change.insert,
          forceMoveMarkers: true
        };
      });
      editor.executeEdits("md-dragger", operations);
    }
  }
  var HANDLE_CLASS = "md-dragger-handle";
  var DRAG_SOURCE_LINE_CLASS = "md-dragger-drag-source";
  var DROP_SEAM_CLASS = "md-dragger-drop-seam";
  var INVALID_CLASS = "is-invalid";
  function resolveConfig(config) {
    const raw = typeof config === "function" ? config() : config;
    if (!(raw.tabSize > 0)) {
      throw new Error(`mdDraggerMonaco: config.tabSize must be positive, got ${String(raw.tabSize)}`);
    }
    if (!(raw.listIndentUnit > 0)) {
      throw new Error(`mdDraggerMonaco: config.listIndentUnit must be positive, got ${String(raw.listIndentUnit)}`);
    }
    return raw;
  }
  function resolveListIndentUnit(options) {
    return resolveConfig(options.config).listIndentUnit;
  }
  function resolveListIndentWidthPx(options, editor) {
    const width = typeof options.listIndentWidthPx === "function" ? options.listIndentWidthPx(editor) : options.listIndentWidthPx;
    if (!(width > 0)) {
      throw new Error(`mdDraggerMonaco: listIndentWidthPx must be positive, got ${String(width)}`);
    }
    return width;
  }
  function monacoDoc(model) {
    return {
      get lines() {
        return model.getLineCount();
      },
      get length() {
        return model.getValueLength();
      },
      line(n) {
        const count = model.getLineCount();
        if (n < 1 || n > count) {
          throw new RangeError(`Line number ${n} out of range 1..${count}`);
        }
        const text = model.getLineContent(n);
        const from = model.getOffsetAt({ lineNumber: n, column: 1 });
        return {
          from,
          to: from + text.length,
          text
        };
      },
      lineAt(pos) {
        const position = model.getPositionAt(pos);
        return { number: position.lineNumber };
      },
      sliceString(from, to) {
        const len = model.getValueLength();
        const end = Math.min(to, len);
        if (from >= end) return "";
        const startPos = model.getPositionAt(from);
        const endPos = model.getPositionAt(end);
        return model.getValueInRange({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        });
      }
    };
  }
  var LINE_HEIGHT_OPTION = 75;
  function lineBand(codeEditor, line, options) {
    const model = codeEditor.getModel();
    if (!model || line < 1 || line > model.getLineCount()) return null;
    const domNode = codeEditor.getDomNode();
    if (!domNode) return null;
    const domRect = domNode.getBoundingClientRect();
    const layout = codeEditor.getLayoutInfo();
    const lineHeight = codeEditor.getOption(LINE_HEIGHT_OPTION);
    const scrollTop = codeEditor.getScrollTop();
    const lineTop = domRect.top + codeEditor.getTopForLineNumber(line) - scrollTop;
    const contentLeft = domRect.left + layout.contentLeft;
    const contentRight = contentLeft + layout.contentWidth;
    const lineText = model.getLineContent(line);
    const resolvedConfig = resolveConfig(options.config);
    const indentUnit = resolveListIndentUnit(options);
    const level = listLevel(lineText, resolvedConfig.tabSize, indentUnit);
    const indentStepPx = resolveListIndentWidthPx(options, codeEditor);
    const left = contentLeft + level * indentStepPx;
    return {
      left,
      right: Math.max(left, contentRight),
      top: lineTop,
      bottom: lineTop + lineHeight
    };
  }
  function dropSeam(codeEditor, position, options) {
    const model = codeEditor.getModel();
    if (!model) return null;
    const domNode = codeEditor.getDomNode();
    if (!domNode) return null;
    const domRect = domNode.getBoundingClientRect();
    const layout = codeEditor.getLayoutInfo();
    const lineHeight = codeEditor.getOption(LINE_HEIGHT_OPTION);
    const scrollTop = codeEditor.getScrollTop();
    const lineCount = model.getLineCount();
    const targetLine = position.line;
    let left;
    if (position.parent) {
      const anchor = lineBand(codeEditor, position.parent.lines.startLine, options);
      if (!anchor) return null;
      left = anchor.left + resolveListIndentWidthPx(options, codeEditor);
    } else {
      left = domRect.left + layout.contentLeft;
    }
    let y;
    if (targetLine <= 1) {
      y = domRect.top + codeEditor.getTopForLineNumber(1) - scrollTop;
    } else if (targetLine > lineCount) {
      y = domRect.top + codeEditor.getTopForLineNumber(lineCount) - scrollTop + lineHeight;
    } else {
      y = domRect.top + codeEditor.getTopForLineNumber(targetLine) - scrollTop;
    }
    const right = Math.max(left, domRect.left + layout.contentLeft + layout.contentWidth);
    return {
      left,
      right,
      y
    };
  }
  var LINE_HEIGHT_OPTION2 = 75;
  function sourceLineFromInput(editor, input) {
    var _a;
    const native = input.native;
    if (native && typeof native === "object" && "target" in native) {
      const target = native.target;
      const handle = (_a = target == null ? void 0 : target.closest(`.${HANDLE_CLASS}`)) != null ? _a : null;
      if (handle) {
        const fromAttr = Number(handle.getAttribute("data-block-start"));
        const model = editor.getModel();
        if (model && Number.isInteger(fromAttr) && fromAttr >= 1 && fromAttr <= model.getLineCount()) {
          return fromAttr;
        }
        return lineAtPoint(editor, input.point);
      }
    }
    return null;
  }
  function lineAtPoint(editor, point) {
    const model = editor.getModel();
    if (!model) return null;
    const target = editor.getTargetAtClientPoint(point.x, point.y);
    if (target == null ? void 0 : target.position) {
      return target.position.lineNumber;
    }
    const domNode = editor.getDomNode();
    if (!domNode) return null;
    const rect = domNode.getBoundingClientRect();
    if (point.y <= rect.top) return 1;
    if (point.y >= rect.bottom) return model.getLineCount() + 1;
    return null;
  }
  function resolveDropPosition(editor, point, selection, options) {
    const model = editor.getModel();
    if (!model) return null;
    const source = selection.blocks[0];
    if (!source) return null;
    const hitLine = lineAtPoint(editor, point);
    if (hitLine === null) return null;
    const doc = monacoDoc(model);
    const resolvedConfig = resolveConfig(options.config);
    const tabSize = resolvedConfig.tabSize;
    const indentUnit = resolveListIndentUnit(options);
    const inDoc = hitLine >= 1 && hitLine <= doc.lines;
    const sourceIndentWidth = source.type === "list-item" ? parseLine(doc.line(source.lines.startLine).text, tabSize).indent.width : 0;
    let targetIndentWidth = sourceIndentWidth;
    if (source.type === "list-item") {
      const originBand = lineBand(editor, source.lines.startLine, options);
      if (originBand) {
        const stepPx = resolveListIndentWidthPx(options, editor);
        const horizontalSteps = Math.round((point.x - originBand.left) / stepPx);
        targetIndentWidth += horizontalSteps * indentUnit;
      }
    }
    const belowMid = inDoc ? isBelowMid(editor, hitLine, point.y) : hitLine > doc.lines;
    const raw = locateDropPosition({
      doc,
      selection,
      hitLine,
      belowMid,
      sourceIndentWidth,
      targetIndentWidth,
      tabSize,
      indentUnit
    });
    return snapDrop({
      raw,
      sourceDoc: doc,
      selection,
      sourceIndentWidth,
      targetIndentWidth,
      tabSize,
      indentUnit
    });
  }
  function isBelowMid(codeEditor, line, y) {
    const domNode = codeEditor.getDomNode();
    if (!domNode) return false;
    const domRect = domNode.getBoundingClientRect();
    const scrollTop = codeEditor.getScrollTop();
    const lineTop = domRect.top + codeEditor.getTopForLineNumber(line) - scrollTop;
    const lineHeight = codeEditor.getOption(LINE_HEIGHT_OPTION2);
    return y > lineTop + lineHeight / 2;
  }
  function pointerInput(editor) {
    var _a;
    const pressHandlers = /* @__PURE__ */ new Set();
    const moveHandlers = /* @__PURE__ */ new Set();
    const releaseHandlers = /* @__PURE__ */ new Set();
    const cancelHandlers = /* @__PURE__ */ new Set();
    const escapeHandlers = /* @__PURE__ */ new Set();
    let pointerDown = false;
    let activePointerId = null;
    const domNode = editor.getDomNode();
    if (!domNode) {
      throw new Error("mdDraggerMonaco: editor has no DOM node");
    }
    const win = (_a = domNode.ownerDocument.defaultView) != null ? _a : window;
    const onPointerDown = (event) => {
      if (event.button !== 0 && event.button !== void 0) return;
      pointerDown = true;
      activePointerId = event.pointerId;
      const input = {
        point: { x: event.clientX, y: event.clientY },
        pointer: { id: event.pointerId, type: event.pointerType },
        button: event.button,
        modifiers: {
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey
        },
        native: event
      };
      for (const handler of pressHandlers) {
        handler(input);
      }
    };
    const onPointerMove = (event) => {
      if (!pointerDown || activePointerId !== null && event.pointerId !== activePointerId) return;
      const input = {
        point: { x: event.clientX, y: event.clientY },
        pointer: { id: event.pointerId, type: event.pointerType },
        buttons: event.buttons,
        native: event
      };
      for (const handler of moveHandlers) {
        handler(input);
      }
    };
    const onPointerUp = (event) => {
      if (!pointerDown || activePointerId !== null && event.pointerId !== activePointerId) return;
      pointerDown = false;
      activePointerId = null;
      const input = {
        point: { x: event.clientX, y: event.clientY },
        pointer: { id: event.pointerId, type: event.pointerType },
        native: event
      };
      for (const handler of releaseHandlers) {
        handler(input);
      }
    };
    const onPointerCancel = (event) => {
      if (!pointerDown || activePointerId !== null && event.pointerId !== activePointerId) return;
      pointerDown = false;
      activePointerId = null;
      const input = {
        pointer: { id: event.pointerId, type: event.pointerType },
        reason: "pointer_cancelled",
        native: event
      };
      for (const handler of cancelHandlers) {
        handler(input);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        for (const handler of escapeHandlers) {
          if (handler()) {
            event.preventDefault();
            event.stopPropagation();
            break;
          }
        }
      }
    };
    domNode.addEventListener("pointerdown", onPointerDown);
    win.addEventListener("pointermove", onPointerMove, { capture: true });
    win.addEventListener("pointerup", onPointerUp, { capture: true });
    win.addEventListener("pointercancel", onPointerCancel, { capture: true });
    win.addEventListener("keydown", onKeyDown, { capture: true });
    return {
      onPress: (handler) => {
        pressHandlers.add(handler);
        return () => pressHandlers.delete(handler);
      },
      onMove: (handler) => {
        moveHandlers.add(handler);
        return () => moveHandlers.delete(handler);
      },
      onRelease: (handler) => {
        releaseHandlers.add(handler);
        return () => releaseHandlers.delete(handler);
      },
      onCancel: (handler) => {
        cancelHandlers.add(handler);
        return () => cancelHandlers.delete(handler);
      },
      onEscape: (handler) => {
        escapeHandlers.add(handler);
        return () => escapeHandlers.delete(handler);
      }
    };
  }
  var _DropSeamWidget = class _DropSeamWidget2 {
    constructor(ownerDoc = typeof document !== "undefined" ? document : {}) {
      var _a, _b;
      this.domNode = (_b = (_a = ownerDoc.createElement) == null ? void 0 : _a.call(ownerDoc, "div")) != null ? _b : {
        style: {},
        classList: { add: () => {
        }, remove: () => {
        } },
        remove: () => {
        }
      };
      this.domNode.className = DROP_SEAM_CLASS;
      this.domNode.style.display = "none";
      this.domNode.style.position = "fixed";
      this.domNode.style.height = "2px";
      this.domNode.style.borderRadius = "2px";
      this.domNode.style.pointerEvents = "none";
      this.domNode.style.zIndex = "1000";
    }
    getId() {
      return _DropSeamWidget2.ID;
    }
    getDomNode() {
      return this.domNode;
    }
    getPosition() {
      return null;
    }
    update(editor, position, invalid, options) {
      if (!position) {
        this.domNode.style.display = "none";
        return;
      }
      const seam = dropSeam(editor, position, options);
      if (!seam) {
        this.domNode.style.display = "none";
        return;
      }
      this.domNode.style.display = "block";
      this.domNode.style.left = `${seam.left}px`;
      this.domNode.style.top = `${seam.y}px`;
      this.domNode.style.width = `${Math.max(10, seam.right - seam.left)}px`;
      if (invalid) {
        this.domNode.classList.add(INVALID_CLASS);
      } else {
        this.domNode.classList.remove(INVALID_CLASS);
      }
    }
    destroy() {
      this.domNode.remove();
    }
  };
  _DropSeamWidget.ID = "md-dragger.drop-seam-widget";
  var DropSeamWidget = _DropSeamWidget;
  var DragHighlightManager = class {
    constructor() {
      this.decorationIds = [];
    }
    update(editor, startLine, endLine) {
      this.clear(editor);
      if (startLine < 1 || endLine < startLine) return;
      this.decorationIds = editor.deltaDecorations(
        [],
        [
          {
            range: {
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: endLine,
              endColumn: 1
            },
            options: {
              isWholeLine: true,
              className: DRAG_SOURCE_LINE_CLASS
            }
          }
        ]
      );
    }
    clear(editor) {
      if (this.decorationIds.length > 0) {
        this.decorationIds = editor.deltaDecorations(this.decorationIds, []);
      }
    }
  };
  function mdDraggerMonaco(editor, options) {
    var _a;
    if (options.enabled && !options.enabled(editor)) {
      return () => {
      };
    }
    const domNode = editor.getDomNode();
    const ownerDoc = (_a = domNode == null ? void 0 : domNode.ownerDocument) != null ? _a : typeof document !== "undefined" ? document : {};
    const seamWidget = new DropSeamWidget(ownerDoc);
    editor.addOverlayWidget(seamWidget);
    const highlightManager = new DragHighlightManager();
    const input = pointerInput(editor);
    const runtime = new DraggerRuntime({
      input,
      document: {
        getDoc: () => {
          const model = editor.getModel();
          if (!model) throw new Error("mdDraggerMonaco: editor has no model");
          return monacoDoc(model);
        }
      },
      locate: {
        sourceLineFromInput: (press) => {
          var _a2;
          return ((_a2 = options.locate) == null ? void 0 : _a2.sourceLineFromInput) ? options.locate.sourceLineFromInput(press) : sourceLineFromInput(editor, press);
        },
        resolveDropPosition: (point, context) => {
          var _a2;
          return ((_a2 = options.locate) == null ? void 0 : _a2.resolveDropPosition) ? options.locate.resolveDropPosition(point, context) : resolveDropPosition(editor, point, context.selection, options);
        },
        lineFromPoint: (point) => {
          var _a2;
          return ((_a2 = options.locate) == null ? void 0 : _a2.lineFromPoint) ? options.locate.lineFromPoint(point) : lineAtPoint(editor, point);
        }
      },
      commit: {
        apply: (edits) => applyCommit(editor, edits)
      },
      config: resolveConfig(options.config),
      ux: typeof options.ux === "function" ? options.ux(editor) : options.ux,
      onChange: (result) => {
        const model = editor.getModel();
        if (!model) return;
        const doc = monacoDoc(model);
        const { position, invalid } = dropSeamState(result.outputs, doc);
        seamWidget.update(editor, position, invalid, options);
        const selection = selectionFromOutputs(result.outputs);
        if (selection) {
          const ranges = selectionLineRanges(model.getLineCount(), selection);
          if (ranges.length > 0) {
            highlightManager.update(editor, ranges[0].startLine, ranges[ranges.length - 1].endLine);
          } else {
            highlightManager.clear(editor);
          }
        } else {
          highlightManager.clear(editor);
        }
      }
    });
    runtime.mount();
    return () => {
      runtime.destroy();
      editor.removeOverlayWidget(seamWidget);
      seamWidget.destroy();
      highlightManager.clear(editor);
    };
  }

  // node_modules/.pnpm/md-dragger@file+..+md-dragger_monaco-editor@0.57.0/node_modules/md-dragger/dist/npm/domain.mjs
  function isHorizontalRuleLine2(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;
    return /^([-*_])(?:\s*\1){2,}$/.test(trimmed);
  }
  function isCalloutLine2(text) {
    if (!text) return false;
    return /^(\s*> ?)+\s*\[!/.test(text.trimStart());
  }
  function isTableLine2(text) {
    if (!text) return false;
    return text.trimStart().startsWith("|");
  }
  function isMathFenceLine2(text) {
    if (!text) return false;
    return text.trimStart().startsWith("$$");
  }
  function isCodeFenceLine2(text) {
    if (!text) return false;
    return text.trimStart().startsWith("```");
  }
  var fenceLazyScanCache2 = /* @__PURE__ */ new WeakMap();
  function isSingleLineMathFence2(lineText) {
    const trimmed = lineText.trimStart();
    if (!trimmed.startsWith("$$")) return false;
    return trimmed.slice(2).includes("$$");
  }
  function assignFenceRangeByLine2(rangeByLine, startLine, endLine) {
    const range = { startLine, endLine };
    for (let i = startLine; i <= endLine; i++) {
      rangeByLine.set(i, range);
    }
  }
  function createFenceLazyScanState2() {
    return {
      scannedUntilLine: 0,
      openCodeStartLine: 0,
      openMathStartLine: 0,
      fullyScanned: false,
      codeRangeByLine: /* @__PURE__ */ new Map(),
      mathRangeByLine: /* @__PURE__ */ new Map()
    };
  }
  function getFenceLazyScanState2(doc) {
    const cached = fenceLazyScanCache2.get(doc);
    if (cached) return cached;
    const created = createFenceLazyScanState2();
    fenceLazyScanCache2.set(doc, created);
    return created;
  }
  function scanFenceLine2(state, lineNumber, text) {
    if (state.openCodeStartLine !== 0) {
      if (isCodeFenceLine2(text)) {
        assignFenceRangeByLine2(state.codeRangeByLine, state.openCodeStartLine, lineNumber);
        state.openCodeStartLine = 0;
      }
      return;
    }
    if (state.openMathStartLine !== 0) {
      if (isMathFenceLine2(text)) {
        assignFenceRangeByLine2(state.mathRangeByLine, state.openMathStartLine, lineNumber);
        state.openMathStartLine = 0;
      }
      return;
    }
    if (isCodeFenceLine2(text)) {
      state.openCodeStartLine = lineNumber;
      return;
    }
    if (isMathFenceLine2(text)) {
      if (isSingleLineMathFence2(text)) {
        assignFenceRangeByLine2(state.mathRangeByLine, lineNumber, lineNumber);
      } else {
        state.openMathStartLine = lineNumber;
      }
    }
  }
  function finalizeFenceStateAtDocEnd2(state) {
    if (state.openCodeStartLine !== 0) {
      assignFenceRangeByLine2(state.codeRangeByLine, state.openCodeStartLine, state.openCodeStartLine);
      state.openCodeStartLine = 0;
    }
    state.openMathStartLine = 0;
    state.fullyScanned = true;
  }
  function ensureFenceScanComplete2(doc) {
    const state = getFenceLazyScanState2(doc);
    if (state.fullyScanned) return state;
    let cursor = state.scannedUntilLine + 1;
    while (cursor <= doc.lines) {
      scanFenceLine2(state, cursor, doc.line(cursor).text);
      cursor++;
    }
    state.scannedUntilLine = Math.max(state.scannedUntilLine, cursor - 1);
    finalizeFenceStateAtDocEnd2(state);
    return state;
  }
  function findMathBlockRange2(doc, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    const state = ensureFenceScanComplete2(doc);
    return (_a = state.mathRangeByLine.get(lineNumber)) != null ? _a : null;
  }
  function findCodeBlockRange2(doc, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber > doc.lines) return null;
    const state = ensureFenceScanComplete2(doc);
    return (_a = state.codeRangeByLine.get(lineNumber)) != null ? _a : null;
  }
  function indentWidth2(raw, tabSize) {
    let width = 0;
    for (const ch of raw) {
      width += ch === "	" ? tabSize : 1;
    }
    return width;
  }
  function splitQuote2(line) {
    const match = line.match(/^(\s*> ?)+/);
    if (!match) return { prefix: "", depth: 0, rest: line };
    const prefix = match[0];
    return {
      prefix,
      depth: (prefix.match(/>/g) || []).length,
      rest: line.slice(prefix.length)
    };
  }
  function parseMarkerAndBody2(rest) {
    var _a;
    const indentMatch = rest.match(/^(\s*)/);
    const indentRaw = (_a = indentMatch == null ? void 0 : indentMatch[1]) != null ? _a : "";
    const afterIndent = rest.slice(indentRaw.length);
    const headingMatch = afterIndent.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const text = headingMatch[0];
      const level = headingMatch[1].length;
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "heading", text, level },
        body: afterIndent.slice(text.length)
      };
    }
    if (isHorizontalRuleLine2(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "hr", text: afterIndent },
        body: ""
      };
    }
    if (isCodeFenceLine2(afterIndent)) {
      const info = afterIndent.replace(/^```\s*/, "").trim() || void 0;
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "fence", text: afterIndent, fence: "code", info },
        body: ""
      };
    }
    if (isMathFenceLine2(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "fence", text: afterIndent, fence: "math" },
        body: ""
      };
    }
    if (isTableLine2(afterIndent)) {
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "table-row", text: afterIndent },
        body: ""
      };
    }
    if (isCalloutLine2(afterIndent) || /^\[![^\]]+\]/.test(afterIndent)) {
      const m = afterIndent.match(/^\[!([^\]]+)\]\s*/);
      if (m) {
        return {
          indent: { raw: indentRaw, width: 0 },
          marker: { kind: "callout", text: m[0], calloutType: m[1] },
          body: afterIndent.slice(m[0].length)
        };
      }
    }
    const taskMatch = afterIndent.match(/^([-*+])\s\[([ xX])\]\s+/);
    if (taskMatch) {
      const text = taskMatch[0];
      const checked = taskMatch[2] !== " ";
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "task", checked },
        body: afterIndent.slice(text.length)
      };
    }
    const unorderedMatch = afterIndent.match(/^([-*+])\s+/);
    if (unorderedMatch) {
      const text = unorderedMatch[0];
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "unordered" },
        body: afterIndent.slice(text.length)
      };
    }
    const orderedMatch = afterIndent.match(/^(\d+)[.)]\s+/);
    if (orderedMatch) {
      const text = orderedMatch[0];
      return {
        indent: { raw: indentRaw, width: 0 },
        marker: { kind: "list", text, markerType: "ordered" },
        body: afterIndent.slice(text.length)
      };
    }
    return {
      indent: { raw: indentRaw, width: 0 },
      marker: null,
      body: afterIndent
    };
  }
  function parseLine2(text, tabSize) {
    const { prefix, depth, rest } = splitQuote2(text);
    const { indent, marker, body } = parseMarkerAndBody2(rest);
    return {
      raw: text,
      quote: { depth, prefix },
      indent: {
        raw: indent.raw,
        width: indentWidth2(indent.raw, tabSize)
      },
      marker,
      body
    };
  }
  function isListLine2(p) {
    var _a;
    return ((_a = p.marker) == null ? void 0 : _a.kind) === "list";
  }
  var lineMapCache2 = /* @__PURE__ */ new WeakMap();
  var EMPTY_LINE_META2 = {
    isEmpty: true,
    isList: false,
    isQuote: false,
    isCallout: false,
    isTable: false,
    isHr: false,
    indentWidth: 0,
    quoteDepth: 0
  };
  function createLineMetaFromText2(text, tabSize) {
    const parsed = parseLine2(text, tabSize);
    const isEmpty = text.trim().length === 0;
    return {
      isEmpty,
      isList: isListLine2(parsed),
      isQuote: parsed.quote.depth > 0,
      isCallout: isCalloutLine2(text),
      isTable: text.trimStart().startsWith("|"),
      isHr: isHorizontalRuleLine2(text),
      indentWidth: parsed.indent.width,
      quoteDepth: parsed.quote.depth
    };
  }
  function createLineMetaArray2(doc, tabSize) {
    var _a;
    const lineMeta = Array(doc.lines + 1);
    lineMeta[0] = EMPTY_LINE_META2;
    for (let i = 1; i <= doc.lines; i++) {
      lineMeta[i] = createLineMetaFromText2((_a = doc.line(i).text) != null ? _a : "", tabSize);
    }
    return lineMeta;
  }
  function buildLineMapIndexes2(lineMeta, totalLines) {
    var _a, _b, _c;
    const prevNonEmpty2 = new Int32Array(totalLines + 2);
    const nextNonEmpty2 = new Int32Array(totalLines + 2);
    const prevListLine = new Int32Array(totalLines + 2);
    const listParentLine = new Int32Array(totalLines + 2);
    const listSubtreeEndLine = new Int32Array(totalLines + 2);
    let previous = 0;
    let previousList = 0;
    const listStack = [];
    for (let i = 1; i <= totalLines; i++) {
      const meta = (_a = lineMeta[i]) != null ? _a : EMPTY_LINE_META2;
      if (!meta.isEmpty) {
        previous = i;
      }
      prevNonEmpty2[i] = previous;
      if (meta.isEmpty) {
        prevListLine[i] = previousList;
        continue;
      }
      while (listStack.length > 0) {
        const topLine = listStack[listStack.length - 1];
        const topMeta = (_b = lineMeta[topLine]) != null ? _b : EMPTY_LINE_META2;
        if (meta.indentWidth > topMeta.indentWidth) {
          break;
        }
        listStack.pop();
      }
      for (const ancestorLine of listStack) {
        listSubtreeEndLine[ancestorLine] = i;
      }
      prevListLine[i] = previousList;
      if (!meta.isList) {
        continue;
      }
      listParentLine[i] = listStack.length > 0 ? listStack[listStack.length - 1] : 0;
      listSubtreeEndLine[i] = i;
      listStack.push(i);
      previousList = i;
    }
    let next = 0;
    for (let i = totalLines; i >= 1; i--) {
      const meta = (_c = lineMeta[i]) != null ? _c : EMPTY_LINE_META2;
      if (!meta.isEmpty) {
        next = i;
      }
      nextNonEmpty2[i] = next;
    }
    return {
      prevNonEmpty: prevNonEmpty2,
      nextNonEmpty: nextNonEmpty2,
      prevListLine,
      listParentLine,
      listSubtreeEndLine
    };
  }
  function createLineMapFromMeta2(doc, tabSize, lineMeta) {
    const indexes = buildLineMapIndexes2(lineMeta, doc.lines);
    return {
      doc,
      lineMeta,
      prevNonEmpty: indexes.prevNonEmpty,
      nextNonEmpty: indexes.nextNonEmpty,
      prevListLine: indexes.prevListLine,
      listParentLine: indexes.listParentLine,
      listSubtreeEndLine: indexes.listSubtreeEndLine,
      tabSize
    };
  }
  function buildLineMap2(doc, options) {
    const tabSize = options.tabSize;
    const lineMeta = createLineMetaArray2(doc, tabSize);
    return createLineMapFromMeta2(doc, tabSize, lineMeta);
  }
  function getCachedLineMapForDoc2(doc, tabSize) {
    var _a, _b;
    if (!doc || typeof doc !== "object") return null;
    return (_b = (_a = lineMapCache2.get(doc)) == null ? void 0 : _a.get(tabSize)) != null ? _b : null;
  }
  function setCachedLineMapForDoc2(doc, tabSize, lineMap) {
    const byTabSize = lineMapCache2.get(doc);
    if (byTabSize) {
      byTabSize.set(tabSize, lineMap);
      return;
    }
    lineMapCache2.set(doc, /* @__PURE__ */ new Map([[tabSize, lineMap]]));
  }
  function getLineMap2(doc, options) {
    const tabSize = options.tabSize;
    if (!doc || typeof doc !== "object") {
      return buildLineMap2(doc, { tabSize });
    }
    const cached = getCachedLineMapForDoc2(doc, tabSize);
    if (cached) {
      return cached;
    }
    const built = buildLineMap2(doc, { tabSize });
    setCachedLineMapForDoc2(doc, tabSize, built);
    return built;
  }
  function peekCachedLineMap2(doc, options) {
    const tabSize = options.tabSize;
    if (!doc || typeof doc !== "object") return null;
    return getCachedLineMapForDoc2(doc, tabSize);
  }
  function getLineMetaAt2(lineMap, lineNumber) {
    var _a;
    if (lineNumber < 1 || lineNumber >= lineMap.lineMeta.length) return null;
    return (_a = lineMap.lineMeta[lineNumber]) != null ? _a : null;
  }
  var BlockType2 = /* @__PURE__ */ ((BlockType22) => {
    BlockType22["Paragraph"] = "paragraph";
    BlockType22["Heading"] = "heading";
    BlockType22["ListItem"] = "list-item";
    BlockType22["CodeBlock"] = "code-block";
    BlockType22["Blockquote"] = "blockquote";
    BlockType22["Table"] = "table";
    BlockType22["MathBlock"] = "math-block";
    BlockType22["Callout"] = "callout";
    BlockType22["HorizontalRule"] = "hr";
    BlockType22["Unknown"] = "unknown";
    return BlockType22;
  })(BlockType2 || {});
  function detectBlockType2(lineText, tabSize) {
    var _a, _b, _c, _d, _e, _f;
    const p = parseLine2(lineText, tabSize);
    if (((_a = p.marker) == null ? void 0 : _a.kind) === "heading") return "heading";
    if (((_b = p.marker) == null ? void 0 : _b.kind) === "hr") return "hr";
    if (((_c = p.marker) == null ? void 0 : _c.kind) === "list") return "list-item";
    if (((_d = p.marker) == null ? void 0 : _d.kind) === "fence") {
      return p.marker.fence === "code" ? "code-block" : "math-block";
    }
    if (((_e = p.marker) == null ? void 0 : _e.kind) === "table-row") return "table";
    if (((_f = p.marker) == null ? void 0 : _f.kind) === "callout") return "callout";
    if (p.quote.depth > 0) return "blockquote";
    if (p.body.trim().length === 0 && !p.marker) return "unknown";
    return "paragraph";
  }
  function isCalloutHeaderLine2(text, tabSize) {
    var _a;
    return ((_a = parseLine2(text, tabSize).marker) == null ? void 0 : _a.kind) === "callout";
  }
  function isInsideCalloutContainer2(doc, lineNumber, depth, tabSize) {
    var _a;
    for (let i = lineNumber; i >= 1; i--) {
      const text = doc.line(i).text;
      const p = parseLine2(text, tabSize);
      if (p.quote.depth === 0 || p.quote.depth < depth) break;
      if (((_a = p.marker) == null ? void 0 : _a.kind) === "callout" || isCalloutHeaderLine2(text, tabSize)) return true;
    }
    return false;
  }
  function getBlockquoteContainerRange2(doc, lineNumber, depth, tabSize) {
    let startLine = lineNumber;
    for (let i = lineNumber - 1; i >= 1; i--) {
      const d = parseLine2(doc.line(i).text, tabSize).quote.depth;
      if (d === 0 || d < depth) break;
      startLine = i;
    }
    let endLine = lineNumber;
    for (let i = lineNumber + 1; i <= doc.lines; i++) {
      const d = parseLine2(doc.line(i).text, tabSize).quote.depth;
      if (d === 0 || d < depth) break;
      endLine = i;
    }
    return { startLine, endLine };
  }
  function getListItemSubtreeRange2(doc, lineNumber, tabSize) {
    const current = parseLine2(doc.line(lineNumber).text, tabSize);
    const currentIndent = current.indent.width;
    let endLine = lineNumber;
    for (let i = lineNumber + 1; i <= doc.lines; i++) {
      const nextText = doc.line(i).text;
      if (nextText.trim().length === 0) {
        const lookahead = findNextNonEmptyLine2(doc, i + 1, tabSize);
        if (!lookahead || lookahead.isList && lookahead.indentWidth <= currentIndent || lookahead.indentWidth <= currentIndent) {
          break;
        }
        endLine = i;
        continue;
      }
      const next = parseLine2(nextText, tabSize);
      if (isListLine2(next) && next.indent.width <= currentIndent) {
        break;
      }
      if (isListLine2(next) || next.indent.width > currentIndent) {
        endLine = i;
        continue;
      }
      break;
    }
    return { startLine: lineNumber, endLine };
  }
  function findNextNonEmptyLine2(doc, fromLine, tabSize) {
    for (let i = fromLine; i <= doc.lines; i++) {
      const text = doc.line(i).text;
      if (text.trim().length === 0) continue;
      const p = parseLine2(text, tabSize);
      return { isList: isListLine2(p), indentWidth: p.indent.width };
    }
    return null;
  }
  var blockDetectionCache2 = /* @__PURE__ */ new WeakMap();
  var LINE_MAP_EAGER_MAX2 = 3e4;
  var YAML_FENCE_RE2 = /^-{3}\s*$/;
  var yamlEndCache2 = /* @__PURE__ */ new WeakMap();
  function yamlEndLine2(doc) {
    const cached = yamlEndCache2.get(doc);
    if (cached !== void 0) return cached;
    let endLine = 0;
    if (doc.lines >= 2 && YAML_FENCE_RE2.test(doc.line(1).text)) {
      for (let i = 2; i <= doc.lines; i++) {
        if (YAML_FENCE_RE2.test(doc.line(i).text)) {
          endLine = i;
          break;
        }
      }
    }
    yamlEndCache2.set(doc, endLine);
    return endLine;
  }
  function inYamlFrontmatter2(doc, lineNumber) {
    const endLine = yamlEndLine2(doc);
    return endLine > 0 && lineNumber >= 1 && lineNumber <= endLine;
  }
  function detectBlockUncached2(doc, lineNumber, tabSize) {
    if (lineNumber < 1 || lineNumber > doc.lines) {
      return null;
    }
    if (inYamlFrontmatter2(doc, lineNumber)) {
      return null;
    }
    const lineText = doc.line(lineNumber).text;
    let blockType = detectBlockType2(lineText, tabSize);
    const codeRange = findCodeBlockRange2(doc, lineNumber);
    const mathRange = findMathBlockRange2(doc, lineNumber);
    if (codeRange) {
      blockType = "code-block";
    }
    if (mathRange) {
      blockType = "math-block";
    }
    if (blockType === "unknown") {
      return null;
    }
    let startLine = lineNumber;
    let endLine = lineNumber;
    if (blockType === "code-block" && codeRange) {
      startLine = codeRange.startLine;
      endLine = codeRange.endLine;
    }
    if (blockType === "math-block" && mathRange) {
      startLine = mathRange.startLine;
      endLine = mathRange.endLine;
    }
    if (blockType === "list-item") {
      let lineMap = peekCachedLineMap2(doc, { tabSize });
      if (!lineMap && doc.lines <= LINE_MAP_EAGER_MAX2) {
        lineMap = getLineMap2(doc, { tabSize });
      }
      const lineMeta = lineMap ? getLineMetaAt2(lineMap, lineNumber) : null;
      const subtreeEndLine = (lineMeta == null ? void 0 : lineMeta.isList) && lineMap ? lineMap.listSubtreeEndLine[lineNumber] : 0;
      if (subtreeEndLine >= lineNumber) {
        endLine = subtreeEndLine;
      } else {
        endLine = getListItemSubtreeRange2(doc, lineNumber, tabSize).endLine;
      }
    }
    if (blockType === "blockquote" || blockType === "callout") {
      const quoteDepth = parseLine2(lineText, tabSize).quote.depth;
      const inCallout = blockType === "callout" || isInsideCalloutContainer2(doc, lineNumber, quoteDepth, tabSize);
      if (inCallout) {
        const range = getBlockquoteContainerRange2(doc, lineNumber, quoteDepth, tabSize);
        startLine = range.startLine;
        endLine = range.endLine;
        blockType = "callout";
      } else {
        startLine = lineNumber;
        endLine = lineNumber;
        blockType = "blockquote";
      }
    }
    if (blockType === "table") {
      for (let i = lineNumber - 1; i >= 1; i--) {
        if (isTableLine2(doc.line(i).text)) startLine = i;
        else break;
      }
      for (let i = lineNumber + 1; i <= doc.lines; i++) {
        if (isTableLine2(doc.line(i).text)) endLine = i;
        else break;
      }
    }
    return {
      type: blockType,
      lines: { startLine, endLine }
    };
  }
  function detectBlock2(doc, lineNumber, options) {
    var _a;
    const tabSize = options.tabSize;
    let cacheByTabSize = blockDetectionCache2.get(doc);
    if (!cacheByTabSize) {
      cacheByTabSize = /* @__PURE__ */ new Map();
      blockDetectionCache2.set(doc, cacheByTabSize);
    }
    let perDocCache = cacheByTabSize.get(tabSize);
    if (!perDocCache) {
      perDocCache = /* @__PURE__ */ new Map();
      cacheByTabSize.set(tabSize, perDocCache);
    }
    if (perDocCache.has(lineNumber)) {
      return (_a = perDocCache.get(lineNumber)) != null ? _a : null;
    }
    const block = detectBlockUncached2(doc, lineNumber, tabSize);
    if (block) {
      perDocCache.set(block.lines.startLine, block);
      for (let n = block.lines.startLine + 1; n <= block.lines.endLine; n++) {
        if (isListLine2(parseLine2(doc.line(n).text, tabSize))) {
          continue;
        }
        perDocCache.set(n, block);
      }
    } else {
      perDocCache.set(lineNumber, null);
    }
    return block;
  }
  var ALL_TYPES2 = Object.values(BlockType2);
  function rejectEntries2(types, slot, reason) {
    return types.map((t) => [`${t}|${slot}`, reason]);
  }
  var REJECT_RULES2 = new Map([
    ...rejectEntries2(ALL_TYPES2, "inside_code_block", "inside_code_block"),
    ...rejectEntries2(ALL_TYPES2, "inside_math_block", "inside_math_block"),
    ...rejectEntries2(
      ALL_TYPES2.filter(
        (t) => t !== "list-item"
        /* ListItem */
      ),
      "inside_list",
      "inside_list"
    ),
    ...rejectEntries2(
      ALL_TYPES2.filter(
        (t) => t !== "blockquote"
        /* Blockquote */
      ),
      "inside_quote_run",
      "inside_quote_run"
    ),
    ...rejectEntries2([
      "callout"
      /* Callout */
    ], "quote_before", "quote_boundary"),
    ...rejectEntries2(
      ALL_TYPES2.filter(
        (t) => t !== "blockquote"
        /* Blockquote */
      ),
      "quote_after",
      "quote_boundary"
    ),
    ...rejectEntries2(ALL_TYPES2, "callout_after", "callout_after"),
    ...rejectEntries2(ALL_TYPES2, "table_before", "table_before"),
    ...rejectEntries2(ALL_TYPES2, "hr_before", "hr_before")
  ]);

  // src/handle.ts
  var FloatingHandleWidget = class {
    constructor() {
      __publicField(this, "domNode");
      __publicField(this, "attachedEditor", null);
      this.domNode = document.createElement("div");
      this.domNode.className = `${HANDLE_CLASS} md-dragger-floating-handle`;
      this.domNode.innerHTML = "\u22EE\u22EE";
      this.domNode.title = "Drag to move block";
    }
    getDomNode() {
      return this.domNode;
    }
    attach(editorInstance, tabSize) {
      this.attachedEditor = editorInstance;
      const domNode = editorInstance.getDomNode();
      if (!domNode) return () => {
      };
      domNode.appendChild(this.domNode);
      const onMouseMove = (event) => {
        const model = editorInstance.getModel();
        if (!model) {
          this.hide();
          return;
        }
        const hitLine = lineAtPoint(editorInstance, { x: event.clientX, y: event.clientY });
        if (!hitLine || hitLine < 1 || hitLine > model.getLineCount()) {
          this.hide();
          return;
        }
        const doc = monacoDoc(model);
        const block = detectBlock2(doc, hitLine, { tabSize });
        if (!block) {
          this.hide();
          return;
        }
        const blockStart = block.lines.startLine;
        const layout = editorInstance.getLayoutInfo();
        const scrollTop = editorInstance.getScrollTop();
        const topPx = editorInstance.getTopForLineNumber(blockStart) - scrollTop;
        const leftPx = Math.max(2, layout.contentLeft - 22);
        this.show(blockStart, topPx, leftPx);
      };
      const onMouseLeave = () => {
        this.hide();
      };
      domNode.addEventListener("mousemove", onMouseMove);
      domNode.addEventListener("mouseleave", onMouseLeave);
      return () => {
        domNode.removeEventListener("mousemove", onMouseMove);
        domNode.removeEventListener("mouseleave", onMouseLeave);
        this.domNode.remove();
        this.attachedEditor = null;
      };
    }
    show(line, topPx, leftPx) {
      this.domNode.setAttribute("data-block-start", String(line));
      this.domNode.style.top = `${topPx}px`;
      this.domNode.style.left = `${leftPx}px`;
      this.domNode.style.display = "flex";
    }
    hide() {
      this.domNode.style.display = "none";
    }
  };

  // src/styles.ts
  var STYLES = `
/* Drag Handle in Margin */
.md-dragger-floating-handle {
    position: absolute;
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: #656d76;
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 3px;
    font-size: 11px;
    line-height: 1;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    z-index: 999;
    transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}

.md-dragger-floating-handle:hover {
    color: #1f2328;
    background: #eaecf0;
    border-color: #8c959f;
}

.md-dragger-floating-handle:active {
    cursor: grabbing;
}

/* Drop Seam Indicator */
.md-dragger-drop-seam {
    position: fixed;
    height: 2px;
    border-radius: 2px;
    background-color: #0969da;
    box-shadow: 0 0 4px rgba(9, 105, 218, 0.4);
    z-index: 10000;
    pointer-events: none;
}

.md-dragger-drop-seam.is-invalid {
    background-color: #cf222e;
    box-shadow: 0 0 4px rgba(207, 34, 46, 0.4);
}

/* Drag Source Block Highlight */
.md-dragger-drag-source {
    background-color: rgba(9, 105, 218, 0.08) !important;
    border-left: 3px solid #0969da !important;
}
`;
  function injectStyles() {
    if (document.getElementById("web-dragger-styles")) return;
    const style = document.createElement("style");
    style.id = "web-dragger-styles";
    style.textContent = STYLES;
    (document.head || document.documentElement).appendChild(style);
  }

  // src/index.ts
  function isMarkdownEditor(ed) {
    const model = ed.getModel();
    if (!model) return false;
    const lang = model.getLanguageId?.();
    if (lang === "markdown") return true;
    const uri = model.uri?.path ?? "";
    if (uri.endsWith(".md") || uri.endsWith(".markdown")) return true;
    if (location.pathname.endsWith(".md") || location.pathname.endsWith(".markdown")) return true;
    return false;
  }
  function init() {
    injectStyles();
    const attached = /* @__PURE__ */ new WeakSet();
    const attach = (ed) => {
      if (attached.has(ed)) return;
      if (!isMarkdownEditor(ed)) return;
      attached.add(ed);
      const tabSize = ed.getModel()?.getOptions().tabSize ?? 4;
      const handleWidget = new FloatingHandleWidget();
      const detachHandle = handleWidget.attach(ed, tabSize);
      const detachDragger = mdDraggerMonaco(ed, {
        config: {
          tabSize,
          listIndentUnit: 2
        },
        listIndentWidthPx: 20
      });
      ed.onDidDispose(() => {
        detachHandle();
        detachDragger();
      });
    };
    const attachAll = (monacoObj) => {
      for (const ed of monacoObj.editor.getEditors()) {
        attach(ed);
      }
      monacoObj.editor.onDidCreateEditor((ed) => {
        attach(ed);
      });
    };
    if (window.monaco?.editor) {
      attachAll(window.monaco);
      return;
    }
    let attempts = 0;
    const maxAttempts = 60;
    const timer = setInterval(() => {
      attempts++;
      if (window.monaco?.editor) {
        clearInterval(timer);
        attachAll(window.monaco);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 200);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
