import type { MantraNode, ParserDiagnostic } from './types';
import { createReaderNodeId } from './renderText';

const LINE_BREAK_PATTERN = /\r\n?/g;
const COMMENT_DIRECTIVE_PATTERN = /^\s*%\s*!TeX[^\n]*$/gim;
const STRUCTURAL_SEPARATOR_PATTERN = /\s*%\s*/g;

const stripTeXComments = (input: string) =>
  input
    .split('\n')
    .map((line) => {
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
    })
    .join('\n');

const makeDiagnostic = (
  level: ParserDiagnostic['level'],
  message: string,
  source?: string,
): ParserDiagnostic => ({
  id: `diag-${level}-${Math.random().toString(36).slice(2, 8)}`,
  level,
  message,
  source,
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

  if (command === 'section' && args[0] !== undefined) {
    return { type: 'section', id: createReaderNodeId('section', index), text: args[0].trim() };
  }

  if (command === 'subsection' && args[0] !== undefined) {
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

  if (command === 'clearpage' || command === 'newpage') {
    return { type: 'pageBreak', id: createReaderNodeId('page-break', index) };
  }

  return null;
};

const buildUnsupportedMacroWarning = (macroNames: string[]) =>
  `Unsupported macro(s): ${Array.from(new Set(macroNames)).map((command) => `\\${command}`).join(', ')}`;

const parseFragment = (fragment: string, diagnostics: ParserDiagnostic[], nodes: MantraNode[]) => {
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
      diagnostics.push(makeDiagnostic('error', `Could not parse \\${macro.command} arguments.`, fragment));
      nodes.push({
        type: 'warning',
        id: createReaderNodeId('warning', nodes.length),
        message: `Malformed command: \\${macro.command}`,
        source: fragment,
      });
      return;
    }

    const supportedNode = nodeFromMacro(macro.command, macro.args, nodes.length);
    if (supportedNode) {
      nodes.push(supportedNode);
      cursor = nextCommandIndex + commandSlice.length - macro.tail.length;
      if (macro.tail) {
        flushText(macro.tail);
        cursor = nextCommandIndex + commandSlice.length;
      }
      continue;
    }

    diagnostics.push(makeDiagnostic('warning', buildUnsupportedMacroWarning([macro.command]), fragment));
    nodes.push({
      type: 'warning',
      id: createReaderNodeId('warning', nodes.length),
      message: buildUnsupportedMacroWarning([macro.command]),
      source: fragment,
    });
    return;
  }
};

const parseParagraphBlocks = (source: string, diagnostics: ParserDiagnostic[]) => {
  const normalized = source.replace(LINE_BREAK_PATTERN, '\n');
  const stripped = stripTeXComments(normalized).replace(COMMENT_DIRECTIVE_PATTERN, '');
  const structuralSource = stripped.replace(STRUCTURAL_SEPARATOR_PATTERN, '\n');
  const blocks = structuralSource.split(/\n{2,}/);
  const nodes: MantraNode[] = [];

  blocks.forEach((block) => {
    const fragment = block.trim();
    if (!fragment) {
      return;
    }
    parseFragment(fragment, diagnostics, nodes);
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
        options?.sourcePath,
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
