#!/usr/bin/env bash
# Genera posters (.webp), previews ligeros (.mp4 sin audio) y el montaje del hero
# a partir de media/videos/*.mp4. Requiere ffmpeg. Ejecutar desde la raíz: bash tools/build-media.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p media/posters media/previews media/hero
for f in media/videos/*.mp4; do
  n=$(basename "$f" .mp4)
  ffmpeg -v error -y -ss 3 -i "$f" -frames:v 1 -vf scale=540:-2 -q:v 72 "media/posters/$n.webp"
  ffmpeg -v error -y -ss 3 -t 6 -i "$f" -an -vf "scale=360:-2,fps=24" -c:v libx264 -crf 31 -preset slow \
    -pix_fmt yuv420p -movflags +faststart "media/previews/$n.mp4"
done
# Montaje del hero: 2 s de cada video, cortes secos
inputs=(); filters=""; i=0
for f in media/videos/*.mp4; do
  inputs+=(-ss 8 -t 2 -i "$f")
  filters+="[$i:v]scale=540:960,setsar=1,fps=24[v$i];"; i=$((i+1))
done
for ((k=0;k<i;k++)); do filters+="[v$k]"; done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filters}concat=n=$i:v=1:a=0[out]" -map "[out]" \
  -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart media/hero/reel.mp4
ffmpeg -v error -y -ss 0.5 -i media/hero/reel.mp4 -frames:v 1 -q:v 75 media/hero/reel-poster.webp
# Logo recortado (el original tiene mucho margen blanco)
ffmpeg -v error -y -i media/fotos/logo.png -vf "crop=352:352:324:306,scale=128:128" media/fotos/logo-mark.png
ffmpeg -v error -y -ss 3 -i media/videos/Aguardiente.mp4 -frames:v 1 -vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" media/og-image.jpg
