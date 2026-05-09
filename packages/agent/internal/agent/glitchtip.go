package agent

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type installGlitchtipPayload struct {
	Domain    string `json:"domain"`
	SecretKey string `json:"secretKey"`
	AdminPass string `json:"adminPass"`
}

func (a *Agent) handleInstallGlitchtip(msg Message) {
	var p installGlitchtipPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		a.sendError(msg.CommandID, "invalid install-glitchtip payload: "+err.Error())
		return
	}

	go func() {
		log := func(s string) { a.sendChunk(msg.CommandID, s) }

		if err := installGlitchtip(p, log); err != nil {
			a.sendError(msg.CommandID, err.Error())
		} else {
			a.sendDone(msg.CommandID, 0)
		}
	}()
}

func installGlitchtip(p installGlitchtipPayload, log func(string)) error {
	dir := "/opt/hylius/glitchtip"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create glitchtip dir: %v", err)
	}

	log("\x1b[36m[1/4] Writing docker-compose.yml...\x1b[0m\n")
	composeFile := filepath.Join(dir, "docker-compose.yml")
	composeContent := fmt.Sprintf(`version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_HOST_AUTH_METHOD: "trust"
    restart: unless-stopped
    volumes:
      - pg-data:/var/lib/postgresql/data
  redis:
    image: redis
    restart: unless-stopped
  web:
    image: glitchtip/glitchtip:v4.0
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://postgres@postgres/postgres
      REDIS_URL: redis://redis:6379
      SECRET_KEY: %s
      PORT: 8000
      GLITCHTIP_DOMAIN: https://%s
      DEFAULT_FROM_EMAIL: hylius@%s
      EMAIL_URL: consolemail://
    restart: unless-stopped
  worker:
    image: glitchtip/glitchtip:v4.0
    command: ./bin/run-celery-with-beat.sh
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://postgres@postgres/postgres
      REDIS_URL: redis://redis:6379
      SECRET_KEY: %s
    restart: unless-stopped

volumes:
  pg-data:
`, p.SecretKey, p.Domain, p.Domain, p.SecretKey)

	if err := os.WriteFile(composeFile, []byte(composeContent), 0644); err != nil {
		return fmt.Errorf("failed to write compose file: %v", err)
	}

	log("\x1b[36m[2/4] Starting GlitchTip services (this may take a minute)...\x1b[0m\n")
	if code := runStream(fmt.Sprintf("cd %s && docker compose up -d", dir), log); code != 0 {
		return fmt.Errorf("docker compose up failed")
	}

	log("\x1b[36m[3/4] Running database migrations...\x1b[0m\n")
	// Give Postgres a few seconds to start
	runStream("sleep 5", log)
	if code := runStream(fmt.Sprintf("cd %s && docker compose exec -T web ./manage.py migrate", dir), log); code != 0 {
		return fmt.Errorf("glitchtip migrate failed")
	}

	log("\x1b[36m[4/4] Creating admin user...\x1b[0m\n")
	createUserCmd := fmt.Sprintf(`cd %s && docker compose exec -T web python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glitchtip.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='admin@hylius.icu').exists():
    User.objects.create_superuser('admin@hylius.icu', '%s')
else:
    u = User.objects.get(email='admin@hylius.icu')
    u.set_password('%s')
    u.save()
"`, dir, p.AdminPass, p.AdminPass)

	if code := runStream(createUserCmd, log); code != 0 {
		return fmt.Errorf("failed to create admin user")
	}

	// Configure Caddy to reverse proxy the domain to port 8000
	log("\x1b[36mConfiguring Caddy reverse proxy...\x1b[0m\n")
	
	// Read existing Caddyfile
	caddyFileBytes, err := os.ReadFile("/opt/hylius/caddy/Caddyfile")
	caddyContent := string(caddyFileBytes)
	if err != nil {
		caddyContent = ""
	}
	
	block := fmt.Sprintf("\n%s {\n\treverse_proxy host.docker.internal:8000\n}\n", p.Domain)
	if !strings.Contains(caddyContent, p.Domain+" {") {
		caddyContent += block
		os.WriteFile("/opt/hylius/caddy/Caddyfile", []byte(caddyContent), 0644)
		runStream("docker exec hylius-caddy caddy reload --config /etc/caddy/Caddyfile", log)
	}

	log("\x1b[32m✅ GlitchTip installed and running!\x1b[0m\n")
	return nil
}

func (a *Agent) handleUninstallGlitchtip(msg Message) {
	go func() {
		log := func(s string) { a.sendChunk(msg.CommandID, s) }
		dir := "/opt/hylius/glitchtip"
		
		log("Stopping and removing GlitchTip containers...\n")
		runStream(fmt.Sprintf("cd %s && docker compose down -v", dir), log)
		os.RemoveAll(dir)
		
		log("GlitchTip uninstalled.\n")
		a.sendDone(msg.CommandID, 0)
	}()
}
