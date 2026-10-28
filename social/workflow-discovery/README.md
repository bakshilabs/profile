# Workflow Discovery videos

Two 28-second silent videos about the Workflow Discovery deck, built with HyperFrames and GSAP.

| File | Format | Use |
| --- | --- | --- |
| `../workflow-discovery-linkedin-square.mp4` | 1080 × 1080, 30 fps | LinkedIn feed |
| `../workflow-discovery-instagram-reel.mp4` | 1080 × 1920, 30 fps | Instagram Reels |

`build.mjs` writes both compositions from one design: `square/index.html` and `reel/index.html`, with the site fonts and GSAP copied in. The captions, practice areas and LEED map are set at the top of the file.

To rebuild:

```bash
npm i -D hyperframes gsap            # in any scratch folder
GSAP=<scratch>/node_modules/gsap/dist/gsap.min.js node social/workflow-discovery/build.mjs
npx hyperframes render social/workflow-discovery/square -o social/workflow-discovery-linkedin-square.mp4 --quality high
npx hyperframes render social/workflow-discovery/reel -o social/workflow-discovery-instagram-reel.mp4 --quality high
```
