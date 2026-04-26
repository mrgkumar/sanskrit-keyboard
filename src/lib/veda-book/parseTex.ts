import type { MantraNode, ParserDiagnostic } from './types';
import { createReaderNodeId } from './renderText';

const LINE_BREAK_PATTERN = /\r\n?/g;
const NEWLINE_BLOCK_PATTERN = /\n\s*\n+/;
const UNKNOWN_COMMAND_PATTERN = /\\([a-zA-Z@]+)/g;

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

const parseParagraphBlocks = (source: string, diagnostics: ParserDiagnostic[]) => {
  const normalized = source.replace(LINE_BREAK_PATTERN, '\n');
  const stripped = stripTeXComments(normalized);
  const blocks = stripped.split(NEWLINE_BLOCK_PATTERN);
  const nodes: MantraNode[] = [];

  blocks.forEach((block) => {
    const text = block.trim();
    if (!text) {
      return;
    }

    const standaloneMacro = parseStandaloneMacro(text);
    if (standaloneMacro && standaloneMacro.kind === 'macro') {
      const node = nodeFromMacro(standaloneMacro.command, standaloneMacro.args, nodes.length);
      if (node && !standaloneMacro.tail) {
        nodes.push(node);
        return;
      }

      if (node && standaloneMacro.tail) {
        diagnostics.push(
          makeDiagnostic('warning', `Macro \\${standaloneMacro.command} had trailing text and was preserved as raw text.`, text),
        );
      }
    }

    if (standaloneMacro && standaloneMacro.kind === 'malformed') {
      diagnostics.push(makeDiagnostic('error', `Could not parse \\${standaloneMacro.command} arguments.`, text));
      nodes.push({
        type: 'warning',
        id: createReaderNodeId('warning', nodes.length),
        message: `Malformed command: \\${standaloneMacro.command}`,
        source: text,
      });
      return;
    }

    const commands = [...text.matchAll(UNKNOWN_COMMAND_PATTERN)].map((match) => match[1]);
    const unsupported = commands.filter(
      (command) => !['chapt', 'section', 'subsection', 'centerline', 'clearpage', 'newpage', 'ta', 'tb', 'ts'].includes(command),
    );

    if (unsupported.length > 0) {
      diagnostics.push(
        makeDiagnostic(
          'warning',
          `Unsupported macro(s): ${Array.from(new Set(unsupported)).map((command) => `\\${command}`).join(', ')}`,
          text,
        ),
      );
      nodes.push({
        type: 'warning',
        id: createReaderNodeId('warning', nodes.length),
        message: `Unsupported macro(s): ${Array.from(new Set(unsupported)).map((command) => `\\${command}`).join(', ')}`,
        source: text,
      });
      return;
    }

    nodes.push({
      type: 'paragraph',
      id: createReaderNodeId('paragraph', nodes.length),
      text,
    });
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
