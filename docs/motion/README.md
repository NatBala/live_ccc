# Motion demos

## Narrated demo (about 1 min 50 s)

`sales-ai-demo-narrated.mp4` (1920×1080, 30 fps, H.264 with AAC voice-over). It's paced to the narration, with captions for every sentence.

| Time | Scene |
|---|---|
| 0–11 s | Title: specialist agents for Sales, Product, Marketing and Service on one shared foundation |
| 11–31 s | Intelligence: Priya's request becomes a structured interpretation (who, intent, scope, timeframe, output), and a rule sets the authority to read-only |
| 31–52 s | Orchestration: five steps in three waves, with data from Salesforce, the data platform and Seismic, returning a timed agenda where every number is traced |
| 52–83 s | Teams working together: Alex's request moves from Sales (Priya) to Product (Dana verifies the dollar costs) to Marketing (Marcus drafts the one-pager) to Compliance (Grace) to Priya's approval, with each handoff going through the shared foundation |
| 83–101 s | Same word, different plan: four ETF requests resolve to four intents and routes |
| 101–110 s | Outro |

### Edit and re-render

- `narrated.html` is the source. Scenes are keyed to the narration cues, and every element is set from the time alone (`render(t)`).
- `narration/narrate.py` holds the script and generates `narration.wav` and `cues.json` with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx). Install it with `pip install kokoro-onnx soundfile`, and put `kokoro.int8.onnx` and `voices.bin` from the kokoro-onnx GitHub releases in `narration/`. The voice is `af_heart`.

```bash
cd docs/motion/narration && python narrate.py && mv narration.wav .. && cd ..
python narration/build.py                       # writes narrated-built.html
mkdir -p frames
N=3303; for k in 0 1 2 3; do node narration/render.mjs $PWD $((k*826)) $(( (k+1)*826 < N ? (k+1)*826 : N )) & done; wait
ffmpeg -framerate 30 -i frames/f%04d.png -i narration.wav -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest -movflags +faststart sales-ai-demo-narrated.mp4
```

You can open `narrated-built.html` (with `narration.wav` next to it) in a browser and click to preview it with sound.

## 15-second teaser

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
