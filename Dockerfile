# 构建阶段将生产子路径写入 Vite 产物；这些公开配置无法在容器启动后再替换。
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ARG APP_ENV=production
ARG VITE_PRODUCTION_APP_BASE_PATH=/flame/admin/
ARG VITE_PRODUCTION_API_BASE_PATH=/flame/admin/api

ENV APP_ENV=${APP_ENV} \
    VITE_PRODUCTION_APP_BASE_PATH=${VITE_PRODUCTION_APP_BASE_PATH} \
    VITE_PRODUCTION_API_BASE_PATH=${VITE_PRODUCTION_API_BASE_PATH}

RUN npm run build

# 运行阶段只保留静态产物，并通过同一容器入口把 API 安全转发至管理端后端。
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/ /usr/share/nginx/html/flame/admin/

EXPOSE 80
