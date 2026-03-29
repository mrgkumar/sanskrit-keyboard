import path from 'node:path';

export const getAutocompleteDataRoot = () =>
  process.env.AUTOCOMPLETE_DATA_ROOT
    ? path.resolve(process.env.AUTOCOMPLETE_DATA_ROOT)
    : path.resolve(process.cwd(), '..', 'generated', 'autocomplete');
