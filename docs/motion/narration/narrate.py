import json, numpy as np, soundfile as sf, sys
from kokoro_onnx import Kokoro
k = Kokoro('kokoro.int8.onnx', 'voices.bin')
VOICE, SPEED, SR = sys.argv[1] if len(sys.argv) > 1 else 'af_heart', 0.94, 24000
SCENES = [
 ('title', ["Meet Connected Client Experience.", "Specialist AI agents for Sales, Product, Marketing, and Service, all working on one shared foundation."]),
 ('intel', ["Priya, a wholesaler, types a request: prepare me for tomorrow's meeting with Daniel's team.",
            "First, the intelligence layer works out what she actually wants.",
            "Who it's about, the business intent, the scope, the timeframe, and the output she needs.",
            "A rule sets the authority to read-only, so nothing gets booked or sent."]),
 ('orch', ["Next, orchestration turns that into a plan that runs in waves.",
           "Three steps run together, pulling Daniel's book, his call notes, and his recent flows from Salesforce and the data platform.",
           "Content and the agenda build on that work.",
           "Priya gets a timed agenda, and every number traces back to a source."]),
 ('team', ["Teams also work together on the same foundation.",
           "Alex asks for Growth Fund of America against the Vanguard growth funds, in dollars, on one page.",
           "Sales captures his request, in his own words.",
           "Product verifies the costs on the data platform.",
           "Marketing drafts the one-page email from Product's verified numbers.",
           "Compliance adds the disclosures, and Priya approves it before anything goes out.",
           "No one repeats work. Each team builds on the last."]),
 ('etf', ["And the intelligence layer reads intent, not keywords.",
          "Find E.T.F. leads. Explain E.T.F. sales. Check E.T.F. availability. Send E.T.F. material.",
          "The same word leads to four different plans, with different data and different controls."]),
 ('outro', ["Sales, Product, Marketing, and Service.", "One foundation. One plan. Every number traced."]),
]
GAP, LEAD, SCENE_GAP, TAIL = 0.35, 0.6, 0.9, 1.6
audio, cues, t = [np.zeros(int(LEAD * SR), dtype=np.float32)], {}, LEAD
for sid, lines in SCENES:
    cues[sid] = {'start': round(t - (LEAD if sid == 'title' else 0.45), 3), 'lines': []}
    for line in lines:
        s, sr = k.create(line, voice=VOICE, speed=SPEED, lang='en-us')
        s = s.astype(np.float32)
        cues[sid]['lines'].append([round(t, 3), round(t + len(s) / SR, 3)])
        audio.append(s); t += len(s) / SR
        audio.append(np.zeros(int(GAP * SR), dtype=np.float32)); t += GAP
    audio.append(np.zeros(int(SCENE_GAP * SR), dtype=np.float32)); t += SCENE_GAP
    cues[sid]['end'] = round(t - 0.45, 3)
audio.append(np.zeros(int(TAIL * SR), dtype=np.float32)); t += TAIL
cues['total'] = round(t, 3)
wav = np.concatenate(audio); wav = wav / max(1e-6, np.abs(wav).max()) * 0.89
sf.write('narration.wav', wav, SR)
json.dump(cues, open('cues.json', 'w'), indent=1)
print('total', round(t, 2), {k2: (v['start'], v['end']) for k2, v in cues.items() if k2 != 'total'})
