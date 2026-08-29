#!/usr/bin/env bash
# TUX showcase — start (or stop) the design review server.
# Usage: ./start.sh [node|python] [--fresh] [--foreground]
#        ./start.sh stop
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(cd ../.. && pwd)"

ENGINE=""
MODE="start"
FRESH=""
EXTRA=()
for a in "$@"; do
  case "$a" in
    node|python) ENGINE="$a" ;;
    stop) MODE="stop" ;;
    --fresh) FRESH=1 ;;
    *) EXTRA+=("$a") ;;
  esac
done

menu() {
  echo
  echo " TUX Showcase — choose the engine that runs the review server:"
  echo "   1  Node  (npm package tux-uix)"
  echo "   2  Python (PyPI package tux-uix)"
  printf " Choice [1]: "
  local ch
  read -r ch
  case "${ch:-1}" in
    1) ENGINE="node" ;;
    2) ENGINE="python" ;;
    *) echo " Invalid choice." ; menu ;;
  esac
}

if [ "$MODE" = "start" ] && [ -z "$ENGINE" ]; then
  menu
fi

TUX=()
resolve() {
  case "$ENGINE" in
    node)
      if command -v tux >/dev/null 2>&1; then TUX=(tux)
      elif [ -f "$REPO/js/bin/tux.js" ]; then TUX=(node "$REPO/js/bin/tux.js")
      else TUX=(npx --yes --package=tux-uix tux); fi
      ;;
    python)
      if [ -x "$REPO/.venv/Scripts/python.exe" ]; then TUX=("$REPO/.venv/Scripts/python.exe" -m tux)
      elif [ -x "$REPO/.venv/bin/python" ]; then TUX=("$REPO/.venv/bin/python" -m tux)
      elif command -v tux >/dev/null 2>&1; then TUX=(tux)
      else TUX=(pipx run tux-uix tux); fi
      ;;
    *)
      if command -v tux >/dev/null 2>&1; then TUX=(tux)
      elif [ -f "$REPO/js/bin/tux.js" ]; then TUX=(node "$REPO/js/bin/tux.js")
      else TUX=(pipx run tux-uix tux); fi
      ;;
  esac
}

if [ "$MODE" = "stop" ]; then
  resolve
  "${TUX[@]}" design stop-review
  exit 0
fi

resolve

if [ -n "$FRESH" ] || [ ! -f ".tux/feedback.json" ]; then
  rm -rf .tux
  echo "Seeding example comments ..."
  "${TUX[@]}" feedback create --type change   --text "Make the primary CTA more prominent."       --route /                    --component Hero          --tux-id hero-cta       --session showcase >/dev/null
  "${TUX[@]}" feedback create --type question --text "Should the prices include VAT here?"        --route /products            --component ProductCard   --instance card-2       --tux-id price-card-2  --session showcase >/dev/null
  "${TUX[@]}" feedback create --type issue    --text "Price overlaps the badge on small screens." --route /product/aurora-lamp --component ProductDetail --instance aurora-lamp  --tux-id product-price --session showcase >/dev/null
  "${TUX[@]}" feedback create --type change   --text "The submit button should read 'Pay now'."   --route /checkout            --component CheckoutForm  --tux-id checkout-submit --session showcase >/dev/null
  "${TUX[@]}" feedback create --type approval --text "Specs tab layout approved as is."           --route /product/aurora-lamp --component ProductTabs   --tux-id specs-tab      --session showcase >/dev/null
fi

echo
echo "Starting the TUX design review server ..."
"${TUX[@]}" design start-review ${EXTRA[@]+"${EXTRA[@]}"}
echo
echo " Showcase: http://127.0.0.1:4321   (stop with: ./start.sh stop)"
