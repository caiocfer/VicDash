# VicDash — Dockerized Vite React TS dev environment
FROM node:22-bookworm-slim

# Preserve npm history / avoid prompts
ENV CI=true
ENV NODE_ENV=development

# Working directory inside the container
WORKDIR /app

# Vite dev server default port
EXPOSE 5173

# Default: run the dev server bound to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
