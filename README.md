# Frameflow

A focused, browser-based camera editor for turning screen recordings into polished product demos.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## V1 workflow

1. Upload an MP4 or MOV.
   - Need a file to try? Use **Download sample** in the header, then upload the included demo video.
2. Scrub to a moment on the timeline.
3. Select **Add focus** and drag or resize the focus area on the canvas.
4. Fine-tune zoom, position, timing, easing, and hold in the inspector.
5. Open **Canvas** to choose a curated background, then adjust the screen padding and background blur for the whole video.
6. Add an optional text overlay, then edit its size, italic style, and position.
7. Add **Full view** or another focus point later in the timeline.
8. Play to preview, then export the directed video.

Camera points and canvas styling are non-destructive. The source video remains unchanged, while camera motion stays inside the framed recording and text remains above the full composition.

## Export support

Frameflow uses the browser's native media encoder. It exports MP4 when the browser exposes an MP4 encoder and falls back to WebM otherwise. The original dimensions are retained and audio is included when the browser exposes the source audio track.

## Production build

```bash
npm run build
```
