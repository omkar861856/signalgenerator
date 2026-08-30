# 🚀 SignalGenerator: Production Maintenance, Deployment & Storage Guide

This document contains key operational rules, maintenance runbooks, and architectural safeguards to keep the production system lean, high-performing, and resilient.

---

## 📌 1. Storage & Disk Space Management

### A. Automatic Log Rotation Limits
All services in `docker-compose.yml` MUST include log rotation limits to prevent Docker log files (`/var/lib/docker/containers/*/*.log`) from growing unbounded:
```yaml
x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### B. High-Frequency MongoDB Data Management
To prevent MongoDB WiredTiger storage files (`/var/lib/docker/volumes/signalgenerator_mongodb_data/_data/*.wt`) from consuming disk space:
- High-volume collections (`ticks`, `candles`, `historical_candles`, `intraday_logs`) should be periodically trimmed or dropped.
- **Fast 1-Line Database & Volume Reset** (if disk exceeds 80%):
  ```bash
  docker compose down && docker volume rm signalgenerator_mongodb_data && docker compose up -d
  ```

### C. Hostinger / KVM VPS SSD Storage TRIM
After purging large files or Docker volumes, run `fstrim` on the server host to notify Hostinger's hypervisor to release SSD blocks:
```bash
fstrim -v /
```

---

## 📌 2. CI/CD & Deployment Pipeline Rules

### A. Docker Volume Masking Prevention
- **CRITICAL**: Do NOT mount `./public:/usr/src/app/public` in production `docker-compose.yml`. Volume mounting `./public` masks the fresh Vite client bundle compiled inside the Docker image during `docker build`.
- Production deployment script in `.github/workflows/deploy.yml`:
  ```yaml
  script: |
    cd /root/SignalGenerator
    git fetch --all
    git reset --hard origin/main
    docker compose up -d --build
    docker image prune -f
  ```

### B. Automatic Client Version Auto-Reload
- The React application (`client/src/App.jsx`) polls `/api/version` every 30 seconds.
- When `server.js` restarts during a deployment, `SERVER_BOOT_TIME` updates, triggering the browser to auto-reload (`window.location.reload(true)`).

---

## 📌 3. API Fault Tolerance & Zero-Crash Safeguards

- State & Strategy Config Endpoints (`/api/state`, `/api/strategy1/config`, `/api/strategy2/config`) check MongoDB connection status (`mongoose.connection.readyState === 1`).
- If MongoDB is reconnecting or performing maintenance, endpoints MUST return HTTP **200 OK** with safe default fallback objects, preventing frontend 500 errors.

---

## 📌 4. Emergency Diagnostic Commands

| Issue | Emergency Command |
|---|---|
| Check Disk Usage | `df -h && du -h --max-depth=1 / 2>/dev/null \| sort -hr` |
| View Container Logs | `docker logs --tail 100 signal-generator-app` |
| Clean Docker System | `docker system prune -af --volumes && docker builder prune -af` |
| Sync Hostinger SSD Space | `fstrim -v /` |
| Test System Endpoints | `curl -i http://localhost:3005/api/version` |
