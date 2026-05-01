FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Fix ajv compatibility issue with react-scripts 5
RUN npm install ajv@^8.17.1 --legacy-peer-deps

COPY . .
ENV GENERATE_SOURCEMAP=false
ENV CI=false
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
