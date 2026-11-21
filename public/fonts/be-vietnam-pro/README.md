# Be Vietnam Pro, bundled locally

Full, unmodified TrueType files for normal weights 400, 500, 600 and 700. They contain Vietnamese glyphs in the same face as Latin text, avoiding mixed-font fallback. No runtime request to Google Fonts is required.

Source: official google/fonts repository, ofl/bevietnampro, commit c13390277dfb1fcc7415d84ef7ef9cfc1e52f8c1.
Upstream font project: https://github.com/bettergui/BeVietnamPro
License: SIL Open Font License 1.1; the original copyright and full license are preserved in OFL.txt.
METADATA.pb is the unmodified Google Fonts metadata for the pinned revision.

Checksums and weights are recorded in checksums.json. Each bundled face was checked as a valid TrueType SFNT with a Unicode cmap. Coverage checks found mappings for all 233 required code points: printable ASCII, Vietnamese base letters, the U+1EA0-U+1EF9 range, and combining grave/acute/circumflex/tilde/breve/hook/horn/dot-below marks. This confirms character mappings, not visual quality in every browser.

The regular face is preloaded from index.html. Remaining weights load only when used by the browser. CSS is in src/styles/fonts.css; font-family and typography metrics are controlled by the shared DTCG tokens.
