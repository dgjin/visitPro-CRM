#!/bin/sh
# VisitPro API (Spring Boot) 启动脚本
# 复用 Node 版 server/.env 的同名环境变量（DB_*/JWT_*/AI_*/PORT 等）
cd "$(dirname "$0")" || exit 1
if [ -f ../server/.env ]; then
  set -a
  . ../server/.env
  set +a
fi
# macOS 上的 JVM 会自动继承系统代理设置（127.0.0.1:7890 的 SOCKS），
# 导致 JDBC 连接 IPv6 loopback（::1）时被 SOCKS 代理劫持而连接失败；
# 这里显式清空代理相关属性（不影响本机直连，AI/Ollama 均为 127.0.0.1 直连）。
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS} -DsocksProxyHost= -Dhttp.proxyHost= -Dhttps.proxyHost="
exec mvn spring-boot:run
