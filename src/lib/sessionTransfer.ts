import type { SessionSnapshot } from '@/store/types';

export interface PersistedLexicalLearningSnapshot {
  version: 1;
  swaraPredictionEnabled: boolean;
  userLexicalUsage: Record<string, number>;
  userExactFormUsage: Record<string, Record<string, number>>;
}

export interface SessionTransferExportV1 {
  kind: 'sanskrit-keyboard-session-export';
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  session: SessionSnapshot;
  lexicalLearning: PersistedLexicalLearningSnapshot;
}

export interface ParsedSessionTransfer {
  session: SessionSnapshot;
  lexicalLearning: PersistedLexicalLearningSnapshot | null;
  source: 'wrapped' | 'legacy';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumberRecord = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'number');

const isNestedNumberRecord = (value: unknown): value is Record<string, Record<string, number>> =>
  isRecord(value) && Object.values(value).every((entry) => isNumberRecord(entry));

const isBlockLike = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  (value.type === 'short' || value.type === 'long') &&
  isString(value.source) &&
  isString(value.rendered);

const isEditorStateLike = (value: unknown) => isRecord(value) && ('viewMode' in value || 'activeBlockId' in value);

const isSessionSnapshotLike = (value: unknown): value is SessionSnapshot =>
  isRecord(value) &&
  isString(value.sessionId) &&
  isString(value.sessionName) &&
  Array.isArray(value.blocks) &&
  value.blocks.every(isBlockLike) &&
  isEditorStateLike(value.editorState) &&
  isString(value.updatedAt) &&
  (value.annotations === undefined || Array.isArray(value.annotations)) &&
  (value.displaySettings === undefined || isRecord(value.displaySettings)) &&
  (value.typography === undefined || isRecord(value.typography));

const isPersistedLexicalLearningSnapshot = (value: unknown): value is PersistedLexicalLearningSnapshot =>
  isRecord(value) &&
  value.version === 1 &&
  typeof value.swaraPredictionEnabled === 'boolean' &&
  isNumberRecord(value.userLexicalUsage) &&
  isNestedNumberRecord(value.userExactFormUsage);

export const createSessionTransferPayload = (
  session: SessionSnapshot,
  lexicalLearning: PersistedLexicalLearningSnapshot,
  appVersion: string
): SessionTransferExportV1 => ({
  kind: 'sanskrit-keyboard-session-export',
  schemaVersion: 1,
  appVersion,
  exportedAt: new Date().toISOString(),
  session,
  lexicalLearning,
});

export const serializeSessionTransferPayload = (payload: SessionTransferExportV1) =>
  `${JSON.stringify(payload, null, 2)}\n`;

export const createSessionTransferFilename = (sessionName: string, sessionId: string) => {
  const safeName = sessionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'session';

  return `sanskrit-keyboard-${safeName}-${sessionId}.json`;
};

export const parseSessionTransferPayload = (raw: string): ParsedSessionTransfer => {
  const parsed = JSON.parse(raw) as unknown;

  if (isRecord(parsed) && parsed.kind === 'sanskrit-keyboard-session-export') {
    if (parsed.schemaVersion !== 1) {
      throw new Error(`Unsupported session export schema version: ${String(parsed.schemaVersion)}`);
    }

    if (!isSessionSnapshotLike(parsed.session)) {
      throw new Error('The session export does not contain a valid session snapshot.');
    }

    if (!isPersistedLexicalLearningSnapshot(parsed.lexicalLearning)) {
      throw new Error('The session export contains invalid lexical learning data.');
    }

    return {
      session: parsed.session,
      lexicalLearning: parsed.lexicalLearning,
      source: 'wrapped',
    };
  }

  if (isSessionSnapshotLike(parsed)) {
    return {
      session: parsed,
      lexicalLearning: null,
      source: 'legacy',
    };
  }

  throw new Error('The selected file is not a valid Sanskrit Keyboard session export.');
};
