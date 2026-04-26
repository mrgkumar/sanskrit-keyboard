import type { MantraNode, ParserDiagnostic } from './types';
import { createReaderNodeId } from './renderText';

const LINE_BREAK_PATTERN = /\r\n?/g;
const COMMENT_DIRECTIVE_PATTERN = /^\s*%\s*!TeX[^\n]*$/im;
const TEXTUAL_LINE_PATTERN = /[\p{L}\p{N}\p{Script=Devanagari}\u0C80-\u0CFF\u0B80-\u0BFF\u0D00-\u0D7F]/u;
const IGNORED_COMMANDS = new Set([
  'begingroup',
  'endgroup',
  'newcommand',
  'renewcommand',
  'setcounter',
  'setmainfont',
  'pagenumbering',
  'setlength',
  'fontspec',
  'lhead',
  'rhead',
  'fancyfoot',
  'chaptertitle',
  'noindent',
  'label',
  'hyperref',
  'mbox',
  'small',
  'hspace',
  'circ',
  'EightFlowerPetal',
  'ip',
  'medskip',
  'smallskip',
  'bigskip',
  'vspace',
  'vfill',
  'newline',
  'linebreak',
  'pagebreak',
  'par',
  'allowdisplaybreaks',
  'raggedright',
  'centering',
  'sloppy',
]);

const stripInlineTeXComments = (line: string) => {
  let result = '';
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '%' && !escaped) {
      break;
    }
    result += char;
    escaped = char === '\\' && !escaped;
  }

  return result;
};

const normalizeTeXLine = (line: string) => {
  const trimmedStart = line.trimStart();
  if (!trimmedStart) {
    return '';
  }

  if (COMMENT_DIRECTIVE_PATTERN.test(line)) {
    return '';
  }

  if (trimmedStart.startsWith('%')) {
    const commentBody = trimmedStart.slice(1).trimStart();
    if (commentBody && !commentBody.startsWith('\\') && TEXTUAL_LINE_PATTERN.test(commentBody)) {
      return commentBody;
    }

    return '';
  }

  return stripInlineTeXComments(line);
};

const makeDiagnostic = (
  level: ParserDiagnostic['level'],
  message: string,
  options?: {
    source?: string;
    line?: number;
    column?: number;
    command?: string;
    nodeId?: string;
  },
): ParserDiagnostic => ({
  id: `diag-${level}-${Math.random().toString(36).slice(2, 8)}`,
  level,
  message,
  source: options?.source,
  line: options?.line,
  column: options?.column,
  nodeId: options?.nodeId,
});

const readBalancedGroup = (input: string, startIndex: number) => {
  if (input[startIndex] !== '{') {
    return null;
  }

  let depth = 0;
  let value = '';
  let index = startIndex;

  for (; index < input.length; index += 1) {
    const char = input[index];
    if (char === '{') {
      if (depth > 0) {
        value += char;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          value,
          nextIndex: index + 1,
        };
      }

      value += char;
      continue;
    }

    if (depth > 0) {
      value += char;
    }
  }

  return null;
};

const parseStandaloneMacro = (line: string) => {
  const trimmed = line.trim();
  const commandMatch = trimmed.match(/^\\([A-Za-z@]+)/);
  if (!commandMatch) {
    return null;
  }

  const command = commandMatch[1];
  const remainder = trimmed.slice(commandMatch[0].length).trimStart();
  const args: string[] = [];
  let cursor = 0;

  while (remainder[cursor] === '{') {
    const group = readBalancedGroup(remainder, cursor);
    if (!group) {
      return { kind: 'malformed', command, remainder };
    }

    args.push(group.value);
    cursor = group.nextIndex;
    while (remainder[cursor] === ' ' || remainder[cursor] === '\t') {
      cursor += 1;
    }
  }

  const tail = remainder.slice(cursor).trim();
  return { kind: 'macro', command, args, tail };
};

const nodeFromMacro = (command: string, args: string[], index: number): MantraNode | null => {
  if (command === 'chapt' && args[0] !== undefined) {
    return { type: 'chapter', id: createReaderNodeId('chapter', index), text: args[0].trim() };
  }

  if (command === 'sect' && args[0] !== undefined) {
    return { type: 'chapter', id: createReaderNodeId('chapter', index), text: args[0].trim() };
  }

  if (command === 'section' && args[0] !== undefined) {
    return { type: 'section', id: createReaderNodeId('section', index), text: args[0].trim() };
  }

  if (command === 'subsection' && args[0] !== undefined) {
    return { type: 'subsection', id: createReaderNodeId('subsection', index), text: args[0].trim() };
  }

  if (command === 'dnsub' && args[0] !== undefined) {
    return { type: 'subsection', id: createReaderNodeId('subsection', index), text: args[0].trim() };
  }

  if (command === 'centerline' && args[0] !== undefined) {
    return { type: 'center', id: createReaderNodeId('center', index), text: args[0].trim() };
  }

  if (command === 'ta' && args.length >= 3) {
    return {
      type: 'sourceRef',
      id: createReaderNodeId('source-ref', index),
      source: 'TA',
      values: args.map((value) => value.trim()),
    };
  }

  if (command === 'tb' && args.length >= 4) {
    return {
      type: 'sourceRef',
      id: createReaderNodeId('source-ref', index),
      source: 'TB',
      values: args.map((value) => value.trim()),
    };
  }

  if (command === 'ts' && args.length >= 4) {
    return {
      type: 'sourceRef',
      id: createReaderNodeId('source-ref', index),
      source: 'TS',
      values: args.map((value) => value.trim()),
    };
  }

  if (command === 'clearpage' || command === 'newpage' || command === 'pagebreak') {
    return { type: 'pageBreak', id: createReaderNodeId('page-break', index) };
  }

  if (command === 'sep' || command === 'anuvakamend' || command === 'prashnaend') {
    return { type: 'pageBreak', id: createReaderNodeId('page-break', index) };
  }

  return null;
};

const buildUnsupportedMacroWarning = (macroNames: string[]) =>
  `Unsupported macro(s): ${Array.from(new Set(macroNames)).map((command) => `\\${command}`).join(', ')}`;

const getLineColumnAtIndex = (fragment: string, index: number, baseLine: number) => {
  const fragmentBeforeIndex = fragment.slice(0, index);
  const lineOffset = fragmentBeforeIndex.split('\n').length - 1;
  const lastLineBreak = fragmentBeforeIndex.lastIndexOf('\n');
  return {
    line: baseLine + lineOffset,
    column: index - (lastLineBreak === -1 ? -1 : lastLineBreak),
  };
};

const parseFragment = (
  fragment: string,
  diagnostics: ParserDiagnostic[],
  nodes: MantraNode[],
  baseLine: number,
) => {
  let cursor = 0;

  const flushText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    nodes.push({
      type: 'paragraph',
      id: createReaderNodeId('paragraph', nodes.length),
      text: trimmed,
    });
  };

  while (cursor < fragment.length) {
    const nextCommandIndex = fragment.indexOf('\\', cursor);
    const textEnd = nextCommandIndex === -1 ? fragment.length : nextCommandIndex;
    flushText(fragment.slice(cursor, textEnd));

    if (nextCommandIndex === -1) {
      break;
    }

    const commandSlice = fragment.slice(nextCommandIndex);
    const macro = parseStandaloneMacro(commandSlice);
    if (!macro) {
      cursor = nextCommandIndex + 1;
      continue;
    }

    if (macro.kind === 'malformed') {
      const location = getLineColumnAtIndex(fragment, nextCommandIndex, baseLine);
      const nodeId = createReaderNodeId('warning', nodes.length);
      diagnostics.push(
        makeDiagnostic('error', `Could not parse \\${macro.command} arguments.`, {
          source: fragment,
          line: location.line,
          column: location.column,
          command: macro.command,
          nodeId,
        }),
      );
      nodes.push({
        type: 'warning',
        id: nodeId,
        message: `Malformed command: \\${macro.command}`,
        source: fragment,
      });
      return;
    }

    const supportedNode = nodeFromMacro(macro.command, macro.args ?? [], nodes.length);
    if (supportedNode) {
      nodes.push(supportedNode);
      if (macro.tail) {
        const tailLocation = getLineColumnAtIndex(fragment, nextCommandIndex, baseLine);
        parseFragment(macro.tail, diagnostics, nodes, tailLocation.line);
      }
      return;
    }

    if (IGNORED_COMMANDS.has(macro.command)) {
      if (macro.tail) {
        const tailLocation = getLineColumnAtIndex(fragment, nextCommandIndex, baseLine);
        parseFragment(macro.tail, diagnostics, nodes, tailLocation.line);
      }
      return;
    }

    const location = getLineColumnAtIndex(fragment, nextCommandIndex, baseLine);
    const nodeId = createReaderNodeId('warning', nodes.length);
    diagnostics.push(
      makeDiagnostic('warning', buildUnsupportedMacroWarning([macro.command]), {
        source: fragment,
        line: location.line,
        column: location.column,
        command: macro.command,
        nodeId,
      }),
    );
    nodes.push({
      type: 'warning',
      id: nodeId,
      message: buildUnsupportedMacroWarning([macro.command]),
      source: fragment,
    });
    return;
  }
};

const parseParagraphBlocks = (source: string, diagnostics: ParserDiagnostic[]) => {
  const normalized = source.replace(LINE_BREAK_PATTERN, '\n');
  const nodes: MantraNode[] = [];
  const lines = normalized.split('\n');
  const blocks: Array<{ lines: Array<{ text: string; lineNumber: number }>; startLine: number }> = [];
  let currentBlock: Array<{ text: string; lineNumber: number }> = [];

  const flushBlock = () => {
    if (currentBlock.length === 0) {
      return;
    }

    blocks.push({
      lines: currentBlock,
      startLine: currentBlock[0]?.lineNumber ?? 1,
    });
    currentBlock = [];
  };

  lines.forEach((line, index) => {
    const normalizedLine = normalizeTeXLine(line);
    if (!normalizedLine.trim()) {
      flushBlock();
      return;
    }

    currentBlock.push({
      text: normalizedLine,
      lineNumber: index + 1,
    });
  });

  flushBlock();

  blocks.forEach((block) => {
    const fragment = block.lines.map((line) => line.text).join('\n').trim();
    if (!fragment) {
      return;
    }
    parseFragment(fragment, diagnostics, nodes, block.startLine);
  });

  return nodes;
};

export const parseTexDocument = (
  rawTex: string,
  options?: { sourcePath?: string },
): { nodes: MantraNode[]; diagnostics: ParserDiagnostic[] } => {
  const diagnostics: ParserDiagnostic[] = [];
  const nodes = parseParagraphBlocks(rawTex, diagnostics);

  if (nodes.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        'info',
        'Document did not contain supported layout commands. Raw text remains available in Source Mode.',
        {
          source: options?.sourcePath,
        },
      ),
    );
    nodes.push({
      type: 'raw',
      id: createReaderNodeId('raw', 0),
      text: rawTex.trim(),
    });
  }

  return { nodes, diagnostics };
};
