#!/bin/sh
# VisitPro API (Spring Boot) 启动脚本
# 复用 Node 版 server/.env 的同名环境变量（DB_*/JWT_*/AI_*/PORT 等）
cd "$(dirname "$0")" || exit 1
if [ -f ../server/.env ]; then
  set -a
  . ../server/.env
  set +a
fi
exec mvn spring-boot:run
