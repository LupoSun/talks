# Talks

Live HTML decks, with PowerPoint and PDF exports for conferences that want a
file uploaded.

**[luposun.github.io/talks](https://luposun.github.io/talks/)**

*Present* opens the slides in their own window — make that full screen on the
projector — and keeps the speaker notes, a timer and the arrow keys on the page
you opened it from.

Built from the deck source in a separate repository; every slide here is the
real thing rather than an export, so nothing can go stale. Regenerate with:

```bash
uv run python presentations/tools/build_site.py --out <dir> \
    --talks iass2026 acadia2026 tsinghua2026
```
