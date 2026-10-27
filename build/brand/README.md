# CastPanel branding

`castpanel-master.png` is the transparent master generated with the built-in imagegen tool, using the user's attached image as a style reference.

Prompt summary: A polished, rounded square app tile with a deep violet, purple and electric cyan-blue gradient. A bold pearlescent white broadcast tower, radio arcs and a speech bubble with an audio waveform form the central mark, with mixing sliders at the sides. Subtle dimensional bevels; readable at small sizes. Transparent outside the tile. No lettering, platform logos, crowns or people.

Generate the Windows multi-resolution ICO, macOS ICNS, Linux PNG sizes and app/site assets with Pillow:

```sh
python scripts/build-icons.py
```

`electron-builder.yml` embeds these assets into each platform's package. `src/main/branding.ts` supplies the running windows' icon; the renderer imports its own generated PNG. Keep the master so future sizes can be generated without another image generation request.
