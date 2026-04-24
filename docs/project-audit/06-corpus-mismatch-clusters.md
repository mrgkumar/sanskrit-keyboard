# Corpus Mismatch Clusters

This file groups the remaining round-trip mismatches from the offline corpus pass into reviewable clusters.

Scope of review:
- `archive/example.txt` used as the local UdakaShanti corpus source
- `data_corpus/ArunaPrashnah.tex`
- `data_corpus/Mahanarayanopanishat.tex`
- `data_corpus/Taittiriyopanishat.tex`

Normalization used for comparison:
- NFC normalization
- `\uF176` normalized to `\u1CDA` for legacy display comparison
- ZWNJ ignored for the corpus comparison pass

## Current Status After Fixes

The corpus scan has been rerun after the `_RRi` / `_M^~_` / bare-`r` fixes.

Current mismatch counts:
- `archive/example.txt`: `22 / 382803`
- `data_corpus/ArunaPrashnah.tex`: `1 / 3802`
- `data_corpus/Mahanarayanopanishat.tex`: `0 / 3753`
- `data_corpus/Taittiriyopanishat.tex`: `0 / 2018`

What those remaining rows are now concentrated in:
- legacy nasal / Vedic mark noise: 13
- residual `r` / `ṛ` cluster cases: 0 after the latest bare-`r` fix in the core corpora, but some `example.txt` rows still use older notation variants
- swara / accent ordering: 7
- separator / punctuation noise: 2

The tables below are the original pre-fix review set that motivated the repair work. They remain useful as provenance, but the counts above are the current truth.

## 1. Repeated Svarita / Double-Svarita

These are source-text or notation-density cases where the Devanagari contains repeated accent marks. The romanization is faithful to the source, but the current reverse path collapses the visible Devanagari differently.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| विधा᳚᳚स्यते | `vidhA''''syate` | विधा᳛॑स्यते |

Notes:
- `vidhA''''syate` should not be collapsed to `vidhA''syate` if the source is being preserved literally.
- The current output is a normalization mismatch, not a proof that the romanization is wrong.

## 2. Legacy Vedic Anusvara / Nasal Clusters

These cases cluster around `ꣳ`, `ꣴ`, and related sequences.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| पुमा॒ꣴ॒स्त्र्य॑स्मि | `pumA_M^~_strya'smi` | पुमा᳔^ँ॒स्त्र्य॑स्मि |
| अतृ॑ष्य॒ꣴ॒स्तृष्य॑ध्यायत् | `atR^i'Shya_M^~_stR^iShya'dhyAyat` | अतृ॑ष्य᳔^ँ॒स्तृष्य॑ध्यायत् |
| वय॒ꣴ॒ | `vaya_M^~_` | वय᳔^ँ॒ |
| तीक्ष्णद॒ꣴ॒ष्ट्राय॑ | `tIkShNada_M^~_ShTrAya'` | तीक्ष्णद᳔^ँ॒ष्ट्राय॑ |
| सो॒मान॒ꣴ॒ | `so_mAna_M^~_` | सो॒मान᳔^ँ॒ |
| गृध्रा॑णा॒ꣴ॒ | `gR^idhrA'NA_M^~_` | गृध्रा॑णा᳔^ँ॒ |
| पु॒रम॑ध्यस॒ꣴ॒स्थम् | `pu_rama'dhyasa_M^~_stham` | पु॒रम॑ध्यस᳔^ँ॒स्थम् |
| स्व॒राडाप॒श्छन्दा॒ꣴ॒स्यापो॒ | `sva_rADApa_shChandA_M^~_syApo_` | स्व॒राडाप॒श्छन्दा᳔^ँ॒स्यापो॒ |
| ज्योती॒ꣴ॒ष्यापो॒ | `jyotI_M^~_ShyApo_` | ज्योती᳔^ँ॒ष्यापो॒ |
| यजू॒ꣴ॒ष्यापः॑ | `yajU_M^~_ShyApa:'` | यजू᳔^ँ॒ष्यापः‌॑ |
| प्रति॒ग्रह॒ꣴ॒ | `prati_graha_M^~_` | प्रति॒ग्रह᳔^ँ॒ |
| सु॒रभि॑र्जुषता॒ꣴ॒ | `su_rabhi'rjuShatA_M^~_` | सु॒रभि॑र्जुषता᳔^ँ॒ |
| भू॑यास॒ꣴ॒ | `bhU'yAsa_M^~_` | भू॑यास᳔^ँ॒ |
| स्मृति॒ꣴ॒ | `smR^iti_M^~_` | स्मृति᳔^ँ॒ |
| स्मार॒ꣴ॒ | `smAra_M^~_` | स्मार᳔^ँ॒ |

Notes:
- These are the main residual cluster in the local `.tex` corpora.
- They are likely the highest-priority normalization gap if exact Devanagari fidelity is required.

## 3. Swara / Accent Ordering

These cases look like accent-order or accent-preservation issues. Some may be source-text noise, but they should still be reviewed as a cluster because the current reverse output visibly changes the tone-mark structure.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| ना॒रा॒श॒स्यर्चाऽभिषि॑ञ्चति | `nA_rA_sha_M~syarchA.abhiShi'~nchati` | ना॒रा॒श᳔ँस्यर्चाऽभिषि॑ञ्चति |
| पुण्य॒ | `puNya_M~` | पुण्य᳔ँ |
| स्वाहा॑कृत॒ | `svAhA'kR^ita_M~` | स्वाहा॑कृत᳔ँ |
| शुम्भा॑नस्त॒नुव॒ | `shumbhA'nasta_nuva_M~` | शुम्भा॑नस्त॒नुव᳔ँ |
| ह॒व्य॒वाह॒ | `ha_vya_vAha_M~` | ह॒व्य॒वाह᳔ँ |
| अ॒ं॒गि॒र॒सी | `a_M_gi_ra_sI` | अ᳔॒गि॒र॒सी |
| अ॒ं॒ | `a_M_` | अ᳔॒ |
| स॒ | `sa_M~` | स᳔ँ |
| ए॒न॒ंस्वायै | `/e_na_M~MsvAyai''` | ए॒न᳔ँस्वायै |
| ए॒न॒ं | `/e_na_M~M` | ए॒न᳔ँ |
| अ॒ꣳशु॒मा᳚प्या॒यय॑न्ति॒ | `a_MM~shu_mA''pyA_yaya'nti_` | अ᳔शु॒माप्या॒यय॑न्ति॒ |

Notes:
- This cluster overlaps with legacy anusvara behavior.
- The `M^~` / `MM~` family is especially visible in these failures.

## 4. Vocalic R / ऋ Cluster

These are cases where the input contains explicit `ऋ` sequences or sandhi around `ऋ`, and the current reverse path still changes the internal cluster shape.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| स॒प्त॒ऋ॒षयः॑ | `sa_pta/_RRi_Shaya:'` | स॒प्तऱ्Rइ॒षयः‌॑ |
| स॑प्त॒ऋषयो॑ | `sa'pta/_RRiShayo'` | स॑प्तऱ्Rइषयो॑ |
| प॑विष्ट॒ऋषी॑णां | `pa'viShTa/_RRiShI'NAM` | प॑विष्टऱ्Rइषी॑णां |
| र॒भ॒त॒ऋ॒ध्नोति॑ | `ra_bha_ta/_RRi_dhnoti'` | र॒भ॒तऱ्Rइ॒ध्नोति॑ |
| वि॒श्वामि॑त्र॒ऋषिः॑ | `vi_shvAmi'tra/_RRiShi:'` | वि॒श्वामि॑त्रऱ्Rइषिः‌॑ |
| सान॑ग॒ऋषिः॑ | `sAna'ga/_RRiShi:'` | सान॑गऱ्Rइषिः‌॑ |
| म॒ऋ॒तु॒ग्र॒हाः | `ma/_RRi_tu_gra_hA:` | मऱ्Rइ॒तु॒ग्र॒हाः |
| ऋ॒तुरृ॑तुरस्मै | `/RRi_turR^i'turasmai` | ऋ॒तुर्ऋ॑तुरस्मै |
| ऋ॒तुरृ॑तु॒रित्यृ॒तुः | `/RRi_turR^i'tu_rityR^i_tu:` | ऋ॒तुर्ऋ॑तु॒रित्यृ॒तुः |
| ब्र॒ह्म॒चर्ये॒ण॒ऋषि॑भ्यः | `bra_hma_charye_Na/_RRiShi'bhya:` | ब्र॒ह्म॒चर्ये॒णऱ्Rइषि॑भ्यः |
| नम॒ऋक् | `nama/_RRik` | नमऱ्Rइक् |

Notes:
- This cluster is now much smaller than the legacy-nasal group, but still important because it changes the visible `ऋ` representation.
- The `r_RRi` fix should reduce the analogous failure mode in freshly tested input.

## 5. Danda / Separator Normalization

These are formatting rather than transliteration problems.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| हरिःओम्।।अविघ्नमस्तुऊँ | `hari:om||avighnamastu/U.N` | हरिःओम्॥अविघ्नमस्तुऊँ |
| प्रायश्चित्तपर्व।।आथर्वणे | `prAyashchittaparva||AtharvaNe` | प्रायश्चित्तपर्व॥आथर्वणे |

## 6. `su` / `suu` Length-Form Cases

These are the cases you pointed out in the UdakaShanti corpus. The source often uses doubled vowel signs or a precision-marked form that the current round-trip normalizes differently.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| सुु॑प॒र्णो | `suu'pa_rNo` | सू॑प॒र्णो |
| सुुभू॑तिर्भद्र॒कृथ्सुव॑र्वान्प॒र्जन्यो॑ | `suubhU'tirbhadra_kR^ithsuva'rvAnpa_rjanyo'` | सूभू॑तिर्भद्र॒कृथ्सुव॑र्वान्प॒र्जन्यो॑ |

Notes:
- These look like source-text or normalization discrepancies, not just a plain `su` vs `suu` transliteration rule.
- The first line likely encodes a long `ū` in the intended reading, but the current reverse path is reducing the glyph sequence differently.

## 7. Other Mixed Normalizations

These are lower-volume cases that do not fit the above buckets cleanly.

| Original Devanagari | Roman | Current Devanagari |
|---|---|---|
| तुभ्यं।।सुजा॑तो॒ | `tubhyaM''||sujA'to_` | तुभ्यं॥सुजा॑तो॒ |
| श्रृण्विरे | `shrR^iNvire` | श्र्ऋण्विरे |
| पूर्वेभिरृषिभिरीड्यो | `pUrvebhirR^iShibhirIDyo` | पूर्वेभिर्ऋषिभिरीड्यो |
| तन्मृत्युर्निरृत्या | `tanmR^ityurnirR^ityA` | तन्मृत्युर्निर्ऋत्या |
| निरृतिरादु | `nirR^itirAdu` | निर्ऋतिरादु |
| निरृतिः | `nirR^iti:` | निर्ऋतिः |
| निरृतिं | `nirR^itiM` | निर्ऋतिं |

## Review Takeaways

1. `vidhA''''syate` is the correct faithful romanization for the source line `विधा᳚᳚स्यते`.
2. The `ऋ` cluster is no longer a single bug class:
   - `R^i` after bare `r` now normalizes to the dependent `ृ` path.
   - `RRi` after bare `r` now preserves the independent `ऋ` path.
   - explicit underscore-bearing forms like `_RRi` and `_M^~_` now round-trip as distinct clusters.
3. The biggest remaining cluster in the local `example.txt` corpus is still the legacy Vedic anusvara family (`ꣳ`, `ꣴ`, and related sequences).
4. The next largest residual class is accent / swara ordering, especially where multiple tone marks or special symbols are adjacent.
5. The `su` / `suu` cases are no longer the dominant residual issue in the current scan and look more source-specific than global.
