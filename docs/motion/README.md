# 15-second motion demo

`sales-ai-demo-15s.mp4` (1920×1080, 30 fps, H.264): the Sales AI story in five beats.

| Time | Scene |
|---|---|
| 0–2 s | Four team agents dock on one shared AI foundation |
| 2–6 s | Priya types a request; the intelligence layer fills the eight-field interpretation, and authority is settled by rule (read-only) |
| 6–10 s | Orchestration in three waves: three steps run together while data flows in from Salesforce, the data platform and Seismic; the agenda comes back, nothing booked or sent |
| 10–13 s | Same word, different plan: four ETF requests resolve to four intents and four routes |
| 13–15 s | Sales, Product, Marketing and Service use cases on one foundation |

## Edit and re-render

`demo.html` is the source. Every element is set from the time alone (`render(t)`), so frames are exact. Open it in a browser to preview it looping in real time.

To render the video again (needs Playwright's Chromium and ffmpeg):

```bash
mkdir -p docs/motion/frames
node docs/motion/render.mjs docs/motion     # writes 450 PNG frames
ffmpeg -framerate 30 -i docs/motion/frames/f%04d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart docs/motion/sales-ai-demo-15s.mp4
```

Fonts (Newsreader and Schibsted Grotesk, SIL Open Font License) are included locally so renders match exactly.
