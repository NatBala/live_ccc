# Inject the narration cues and caption lines into narrated.html -> narrated-built.html
import json, re, os
here = os.path.dirname(os.path.abspath(__file__)); motion = os.path.dirname(here)
src = open(os.path.join(here, 'narrate.py')).read()
scenes = eval(re.search(r'SCENES = (\[.*?\n\])', src, re.S).group(1))
lines = {sid: [l.replace('E.T.F.', 'ETF') for l in ls] for sid, ls in scenes}
h = open(os.path.join(motion, 'narrated.html')).read()
h = h.replace('/*CUES*/null', open(os.path.join(here, 'cues.json')).read()).replace('/*LINES*/null', json.dumps(lines))
open(os.path.join(motion, 'narrated-built.html'), 'w').write(h)
print('wrote narrated-built.html')
