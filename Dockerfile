FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# 添加 nginx 配置（SPA 路由 + 缓存控制）
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    \
    # index.html 禁止缓存，确保每次部署用户都能获取最新入口文件 \
    location = /index.html { \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
    } \
    \
    # 带 hash 的静态资源（JS/CSS/字体/图片）长期缓存 \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        add_header Cache-Control "public, max-age=31536000, immutable"; \
    } \
    \
    # SPA 回退：其他路径返回 index.html \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
