ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache nodejs npm

WORKDIR /app

# Frontend build
COPY web ./web
RUN cd web && npm install && npm run build

# Backend
COPY server ./server
RUN cd server && npm install --omit=dev

COPY rootfs /
RUN chmod a+x /etc/services.d/fintrack/run
