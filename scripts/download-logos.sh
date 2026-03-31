#!/bin/bash
# One-time script to download brand logos from logo.dev into public/logos/
# Usage: LOGO_DEV_TOKEN=xxx bash scripts/download-logos.sh

set -euo pipefail

if [ -z "${LOGO_DEV_TOKEN:-}" ]; then
  echo "Error: set LOGO_DEV_TOKEN env var first"
  echo "Usage: LOGO_DEV_TOKEN=xxx bash scripts/download-logos.sh"
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/logos"
mkdir -p "$DIR"

DOMAINS=(
  naadam.co
  icebreaker.com
  prana.com
  allwear.com
  ecoaya.com
  beaumontorganic.com
  everlane.com
  fairindigo.com
  harvestandmill.com
  indigoluna.store
  industryofallnations.com
  jungmaven.com
  kotn.com
  kowtowclothing.com
  losano.com
  magiclinen.com
  maggiesorganics.com
  matethelabel.com
  nadsunder.com
  wearpact.com
  plainandsimple.com
  pyneandsmith.com
  quince.com
  rawganique.com
  rykerclothingco.com
  tobytiger.co.uk
  vividlinen.com
  woronstore.com
  gilrodriguez.com
  layere.com
)

for domain in "${DOMAINS[@]}"; do
  out="$DIR/$domain.png"
  if [ -f "$out" ]; then
    echo "SKIP $domain (already exists)"
    continue
  fi
  echo -n "Downloading $domain... "
  if curl -fsSL -o "$out" "https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=128&format=png"; then
    echo "OK"
  else
    echo "FAILED"
    rm -f "$out"
  fi
done

echo ""
echo "Done! Downloaded logos to $DIR"
echo "You can now remove your LOGO_DEV_TOKEN — it's no longer needed."
