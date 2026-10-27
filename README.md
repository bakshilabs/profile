# Bakshi Labs

The personal website of Arpan Bakshi, served by GitHub Pages at https://bakshilabs.github.io/profile/.

It is a static single page with no build step. Edit the files directly and push to `main`.

| Path | Contents |
| --- | --- |
| `index.html` | All page content: hero, work, method, services, about, contact, and the seven case-study sheets |
| `agents.html` | The agent workflow slide show, one slide per tool, linked from the Agents menu item |
| `agents-3d.html` | The 3D version of the agent slide show, linked from the 3D view button on the flat deck |
| `workflows.html` | The Sustainable Design Workflows slide show, linked from the Workflows menu item |
| `training.html` | The AI training programme slide show for small businesses, linked from the Training menu item |
| `assets/css/site.css` | Styles, with the colour and type tokens at the top |
| `assets/js/site.js` | Navigation, case-study sheets, walkthrough steps, demo video, copy button |
| `assets/js/stories.js` | The seven animated tool stories, each with a wide and a phone layout |
| `assets/js/agents-data.js` | Cards, connectors and descriptions for each agent workflow slide |
| `assets/js/agents.js` | Builds and scales the slides, routes the connectors and runs the detail window |
| `assets/css/agents.css` | Styles for the agent workflow slides |
| `assets/js/agents-3d.js` | Builds the 3D agent slides: the Three.js backdrop, glowing connectors and glass cards |
| `assets/css/agents-3d.css` | Styles for the 3D agent slides |
| `assets/js/workflows-data.js` | Practice areas, workflows and maps for the workflows slides, from the pain-points repo's sustainability.json |
| `assets/js/workflows.js` | Builds and scales the workflows slides and runs their detail window |
| `assets/css/workflows.css` | Styles for the workflows slides |
| `assets/js/training-data.js` | Programme, levels, steps and results for the training slides |
| `assets/js/training.js` | Builds and scales the training slides and runs their detail window |
| `assets/css/training.css` | Styles for the training slides |
| `assets/js/southwark-data.js` | Southwark ward outlines and a sample of 1,700 homes, from the atlas data |
| `assets/js/world-data.js` | Land cells for the world map, from Natural Earth via world-atlas |
| `assets/img/work/` | Six walkthrough screenshots for each tool |
| `assets/img/cards/` | Still images shown when scripts are off |
| `assets/img/posters/` | First frames for the demo videos |
| `assets/video/` | One demo video per tool (H.264 MP4) |
| `assets/fonts/` | Schibsted Grotesk, Inter and IBM Plex Mono, self-hosted (SIL Open Font License) |

To preview locally, run `npx serve .` in this folder and open the address it prints.
