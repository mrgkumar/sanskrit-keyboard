# Transliteration And Display Invariants

This document records the rules that are not optional for the Sanskrit Keyboard runtime.
It exists to keep transliteration semantics, font-driven rendering, and script-specific normalization from collapsing into each other again.

If a future change conflicts with one of these rules, the change must either:

1. keep the invariant intact, or
2. intentionally revise this document and add targeted tests before shipping.

## 1. Scope

These invariants apply to:

1. canonical ITRANS input and reverse transliteration
2. Devanagari display rendering
3. font preset selection and font-specific normalization
4. Tamil precision formatting and reverse parsing, where it touches shared display code
5. UI preview and copy/export surfaces that render Sanskrit text

They do not apply to:

1. unrelated UI styling that does not alter script text
2. corpus generation internals unless they emit transliterated text into the app UI

## 2. Source Of Truth

1. Canonical ITRANS is the source of truth for Sanskrit input.
2. Rendered Unicode is derived from canonical ITRANS unless a renderer is explicitly in a compatibility mode.
3. The font chosen for display must not change the canonical content.
4. Tamil output must never be used as a hidden source of Sanskrit canonicalization.

### Hard rule

If the same canonical source text is rendered under two different font presets, the underlying Unicode text must remain semantically equivalent.

## 3. Non-Negotiable Transliteration Invariants

### 3.1 Canonical round-trip

1. `श्रीसूक्तम्` must round-trip through the transliteration pipeline as `shrIsUktam`.
2. `श्र`-like cluster behavior must not change because a font preset changes.
3. Canonical reverse transliteration must not depend on font-family selection.

### 3.2 No font-driven semantic mutation

1. Font preset selection may affect glyph shape, mark ordering, and explicit compatibility substitutions.
2. Font preset selection may not change the meaning of the text.
3. Font preset selection may not invent or delete canonical letters, marks, or virama relationships.
4. Font preset selection may not turn a Unicode-safe string into a different canonical string.

### 3.3 No Tamil leakage into Sanskrit canonicalization

1. Raw Tamil renderings are not canonical Sanskrit input.
2. Tamil reverse parsing must remain a separate, explicit path.
3. A Devanagari display fix must never silently alter Tamil reverse behavior.

## 4. Devanagari Display Invariants

### 4.1 Default display must be Unicode-safe

1. The default Devanagari display path must render plain Unicode Devanagari.
2. The default display path must not require private-use glyphs to look correct.
3. The default display path must not depend on a legacy compatibility rewrite.

### 4.2 Siddhanta preset invariant

1. `siddhanta` must render plain Unicode Devanagari.
2. `siddhanta` must not rewrite `प्र` to a private-use glyph.
3. `siddhanta` must preserve the expected visible rendering of `श्रीसूक्तम्` and `श्री`.
4. `siddhanta` may use Unicode-preserving display normalization, but not legacy PUA substitution.

### 4.3 Noto Sans Devanagari invariant

1. `noto-sans` must render plain Unicode Devanagari.
2. `noto-sans` must never trigger legacy private-use glyph rewrites.
3. `noto-sans` is a presentation preset only; it does not alter transliteration output.

### 4.4 Legacy compatibility presets

The following presets are legacy compatibility presets:

1. `chandas`
2. `sampradaya`
3. `sanskrit2003`

For these presets:

1. explicit legacy glyph substitutions are allowed when they are required for the intended font behavior
2. compatibility behavior must be explicit and preset-scoped
3. compatibility rewrites must never leak into plain-Unicode presets

## 5. Font-Based Normalization Rules

### 5.1 What normalization may do

Font-based normalization may:

1. reorder marks when the reorder is visually required and semantically neutral
2. move visarga and Vedic-style marks into the display order expected by the target font
3. rewrite specific compatibility clusters only when the preset explicitly requires it

### 5.2 What normalization may not do

Font-based normalization may not:

1. change canonical consonant/vowel identity
2. alter code-point meaning to satisfy a visual preference
3. apply a legacy rewrite to a plain-Unicode preset
4. add or remove virama, nukta, or vowel signs
5. normalize text in a way that breaks reverse transliteration

### 5.3 Current normalization matrix

This is the expected behavior matrix for the current codebase:

| Preset | Mark reordering | Legacy PUA `प्र` rewrite | Plain Unicode output |
| --- | --- | --- | --- |
| `noto-sans` | no | no | yes |
| `siddhanta` | yes, for supported Vedic/visarga display rules | no | yes |
| `sanskrit2003` | yes, for supported Vedic/visarga display rules | yes | no |
| `chandas` | no | yes | no |
| `sampradaya` | no | yes | no |

If this matrix changes, update this document and the tests together.

## 6. Specific Display Rules

### 6.1 `प्र`

1. `normalizeDevanagariDisplayText('प्र', 'noto-sans')` must return `प्र`.
2. `normalizeDevanagariDisplayText('प्र', 'siddhanta')` must return `प्र`.
3. `normalizeDevanagariDisplayText('प्र', 'chandas')` may return the legacy PUA glyph.
4. `normalizeDevanagariDisplayText('प्र', 'sanskrit2003')` may return the legacy PUA glyph.
5. The legacy glyph must not appear in the plain-Unicode presets.

### 6.2 `श्रीसूक्तम्`

1. The rendered Devanagari output for canonical `shrIsUktam` must be `श्रीसूक्तम्` in the plain-Unicode presets.
2. A font preset must never split or reshape `श्रीसूक्तम्` into a visually broken cluster.
3. The display path may use font fallback to achieve the correct look, but the text content must remain stable.

### 6.3 Vedic marks and visarga

1. Visarga ordering may be normalized for display when the preset requires it.
2. Vedic marks are opt-in in corpus generation and must stay explicit in display normalization rules.
3. A display normalization rule must not move a Vedic mark across a boundary unless that rule is documented and tested.

## 7. Specific Transliteration Rules

### 7.1 Exactness

1. Reverse transliteration must return the expected canonical Roman string for frozen fixtures.
2. Transliteration results must be stable under repeated round-trip checks.
3. Font choice must not affect detransliteration output.

### 7.2 Boundary handling

1. Cluster boundaries must be preserved in transliteration and detransliteration.
2. Extended consonant handling must not silently collapse to a different canonical sequence.
3. Slash-prefixed and ordinary forms must remain distinct where the mapping system distinguishes them.

### 7.3 Error honesty

1. If an input is not supported, the system must reject or preserve it explicitly.
2. The system must not guess a Sanskrit reading from an unrelated Tamil input.
3. The system must not “repair” a string by changing its canonical meaning.

## 8. Testing Requirements

### 8.1 Required canaries

The following strings are mandatory canaries:

1. `श्री`
2. `श्रीसूक्तम्`
3. `प्र`
4. `नम॑ः`
5. a visarga-bearing form such as `नमः॑`

### 8.2 Required assertions

Every relevant change must prove:

1. transliteration round-trip behavior
2. display normalization behavior for each preset it touches
3. the exact Unicode text that is rendered
4. the font preset used to render it

### 8.3 Regression tests must distinguish

1. canonical text correctness
2. font preset selection
3. compatibility glyph substitution
4. visual rendering result in a browser

### 8.4 Minimum test matrix

At minimum, tests should cover:

1. `noto-sans`
2. `siddhanta`
3. `chandas`
4. `sanskrit2003`

and check at least:

1. `श्री`
2. `श्रीसूक्तम्`
3. `प्र`
4. a visarga-accent display case

## 9. Change Policy

Before changing transliteration or Devanagari display code:

1. identify whether the change is semantic, visual, or compatibility-only
2. state which font presets are affected
3. add or update a regression test
4. confirm Tamil behavior is unchanged unless the change explicitly targets Tamil
5. keep the default path plain-Unicode unless the product decision says otherwise

### Disallowed shortcut

Do not fix a visual rendering bug by mutating canonical text unless that mutation is already part of the documented compatibility policy.

## 10. Failure Triage Order

When a rendering or transliteration bug appears, inspect in this order:

1. canonical Roman input
2. transliteration result
3. display normalization output
4. applied font preset
5. browser rendering in the target environment

This prevents the common mistake of blaming transliteration for a font problem.

## 11. Summary

The core principle is simple:

1. transliteration correctness comes first
2. display normalization is allowed only when it preserves meaning
3. font compatibility rewrites must be explicit and preset-scoped
4. plain-Unicode presets must stay plain Unicode
5. Tamil and Devanagari behavior must remain separated unless a test explicitly joins them

