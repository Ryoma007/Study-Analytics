# ===== 阶段4：单容器 Node 全包（API + 静态托管） =====
# 设计见 ADR-0005：node:22-alpine，builder 装编译工具链编译 better-sqlite3
# runtime 全包 Node 进程接管 API + 静态资源 + SPA 回退 + 缓存策略

# ===== 构建阶段 =====
FROM node:22-alpine AS builder

# 安装 better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

# 启用 pnpm（package.json 的 packageManager 已声明版本）
RUN corepack enable

WORKDIR /app

# 复制 workspace 配置与各包 package.json（利用 Docker 层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/

# 安装全部依赖（含 devDependencies，供构建用）
RUN pnpm install --frozen-lockfile

# 复制完整源码并构建（shared → backend → frontend）
COPY . .
RUN pnpm -r build

# ===== 运行阶段 =====
FROM node:22-alpine

WORKDIR /app

# 复制 workspace 结构
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# 复制构建产物
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/frontend/dist ./apps/frontend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# 复制 node_modules（含 better-sqlite3 已编译的 native 模块）
# 注意：packages/shared 零运行时依赖，无 node_modules，无需复制
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# 环境变量
ENV SERVE_STATIC=1
ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "apps/backend/dist/server.js"]
