#!/bin/zsh
GUITARFLOW_PIDS=$(lsof -tiTCP:5173 -sTCP:LISTEN)
for GUITARFLOW_PID in ${=GUITARFLOW_PIDS}; do
  GUITARFLOW_COMMAND=$(ps -p "$GUITARFLOW_PID" -o command=)
  if [[ "$GUITARFLOW_COMMAND" == *"node scripts/serve.mjs"* ]]; then
    kill "$GUITARFLOW_PID"
  fi
done
