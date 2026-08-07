#!/bin/bash
# 启动本地 FunASR 语音识别服务（默认端口 8321）
cd "$(dirname "$0")"
exec .venv/bin/python server.py
