#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/winwidget}"
client_root="${CLIENT_ROOT:-$APP_ROOT/winwidget.ru_client}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/deploy/frontend/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$client_root/deploy/docker-compose.prod.yml}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-30}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-2}"

cd "$APP_ROOT"

deploy_revision="$(git -C "$client_root" rev-parse HEAD)"
expected_revision="${EXPECTED_REVISION:-$deploy_revision}"
if [[ "$deploy_revision" != "$expected_revision" ]]; then
	echo "Deployment revision mismatch: expected $expected_revision, got $deploy_revision" >&2
	exit 1
fi

dirty_files="$(
	git -C "$client_root" status --porcelain --untracked-files=all
)"
if [[ -n "$dirty_files" ]]; then
	echo "Frontend deployment checkout is not clean:" >&2
	echo "$dirty_files" >&2
	exit 1
fi

export APP_REVISION="$deploy_revision"
export APP_VERSION="git-$deploy_revision"

echo "Deploying frontend revision: $APP_REVISION"
echo "Building frontend image: winwidget-client:$APP_VERSION"

if [[ ! -f "$ENV_FILE" ]]; then
	echo "Frontend env file not found: $ENV_FILE" >&2
	exit 1
fi

env_mode="$(stat -c '%a' "$ENV_FILE")"
env_group_digit="${env_mode: -2:1}"
env_other_digit="${env_mode: -1}"
if ((10#$env_group_digit != 0 || 10#$env_other_digit != 0)); then
	echo "Frontend env file must not be accessible by group or others: $ENV_FILE (mode $env_mode)" >&2
	echo "Run: chmod 600 $ENV_FILE" >&2
	exit 1
fi

duplicate_env_keys="$(
	awk '
		/^[[:space:]]*(#|$)/ { next }
		{
			line = $0
			sub(/^[[:space:]]*/, "", line)
			if (line !~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/) next

			name = line
			sub(/[[:space:]]*=.*/, "", name)
			count[name] += 1
		}
		END {
			for (name in count) {
				if (count[name] > 1) print name
			}
		}
	' "$ENV_FILE" | LC_ALL=C sort
)"
if [[ -n "$duplicate_env_keys" ]]; then
	echo "Duplicate environment keys are not allowed in $ENV_FILE:" >&2
	echo "$duplicate_env_keys" >&2
	exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
	echo "Frontend Compose file not found: $COMPOSE_FILE" >&2
	exit 1
fi

ambient_compose_overrides=()
while IFS= read -r key; do
	[[ -n "$key" ]] || continue
	case "$key" in
		APP_REVISION | APP_VERSION)
			continue
			;;
	esac
	if printenv "$key" >/dev/null 2>&1; then
		ambient_compose_overrides+=("$key")
	fi
done < <(
	LC_ALL=C grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*' "$COMPOSE_FILE" |
		sed 's/^${//' |
		LC_ALL=C sort -u
)
if ((${#ambient_compose_overrides[@]} > 0)); then
	echo "Unset shell variables that would override $ENV_FILE in Docker Compose:" >&2
	printf '%s\n' "${ambient_compose_overrides[@]}" >&2
	exit 1
fi

require_env_key() {
	local key="$1"

	if ! awk -F= -v key="$key" '
		/^[[:space:]]*(#|$)/ { next }
		{
			name = $1
			sub(/^[[:space:]]*/, "", name)
			sub(/[[:space:]]*$/, "", name)

			value = $0
			sub(/^[^=]*=/, "", value)
			sub(/\r$/, "", value)
			sub(/^[[:space:]]*/, "", value)
			sub(/[[:space:]]*$/, "", value)

			if (name == key && value != "" && value !~ /^change_me/) ok = 1
		}
		END { exit(ok ? 0 : 1) }
	' "$ENV_FILE"; then
		echo "Missing required $key in $ENV_FILE" >&2
		exit 1
	fi
}

for key in \
	CLIENT_HOST_PORT \
	NEXT_PUBLIC_MODE \
	NEXT_PUBLIC_SITE_URL \
	NEXT_PUBLIC_PRODUCTION_HOST \
	NEXT_PUBLIC_API_URL \
	NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
	NEXT_PUBLIC_RECAPTCHA_HOST \
	JWT_JWKS_URL \
	JWT_ISSUER \
	JWT_AUDIENCE \
	JWT_CLOCK_TOLERANCE_SECONDS \
	JWT_MAX_TOKEN_LIFETIME_SECONDS; do
	require_env_key "$key"
done

if awk -F= '
	/^[[:space:]]*JWT_SECRET[[:space:]]*=/ { found = 1 }
	END { exit(found ? 0 : 1) }
' "$ENV_FILE"; then
	echo "Legacy JWT_SECRET must be removed from $ENV_FILE" >&2
	exit 1
fi

get_env_value() {
	local key="$1"

	awk -F= -v key="$key" '
		/^[[:space:]]*(#|$)/ { next }
		{
			name = $1
			sub(/^[[:space:]]*/, "", name)
			sub(/[[:space:]]*$/, "", name)

			value = $0
			sub(/^[^=]*=/, "", value)
			sub(/\r$/, "", value)
			sub(/^[[:space:]]*/, "", value)
			sub(/[[:space:]]*$/, "", value)

			if (name == key) {
				print value
				found = 1
				exit
			}
		}
		END { exit(found ? 0 : 1) }
	' "$ENV_FILE"
}

jwt_jwks_url="$(get_env_value JWT_JWKS_URL)"
jwt_issuer="$(get_env_value JWT_ISSUER)"
jwt_audience="$(get_env_value JWT_AUDIENCE)"
jwt_clock_tolerance="$(get_env_value JWT_CLOCK_TOLERANCE_SECONDS)"
jwt_max_lifetime="$(get_env_value JWT_MAX_TOKEN_LIFETIME_SECONDS)"
client_host_port="$(get_env_value CLIENT_HOST_PORT)"
next_public_mode="$(get_env_value NEXT_PUBLIC_MODE)"
next_public_site_url="$(get_env_value NEXT_PUBLIC_SITE_URL)"
next_public_production_host="$(get_env_value NEXT_PUBLIC_PRODUCTION_HOST)"
next_public_api_url="$(get_env_value NEXT_PUBLIC_API_URL)"
next_public_recaptcha_host="$(get_env_value NEXT_PUBLIC_RECAPTCHA_HOST)"

if [[ "$jwt_jwks_url" != "https://api.winwidget.ru/api/v1/auth/.well-known/jwks.json" ]] ||
	[[ "$jwt_issuer" != "https://api.winwidget.ru/auth" ]] ||
	[[ "$jwt_audience" != "https://api.winwidget.ru" ]]; then
	echo "Frontend JWT URL, issuer or audience does not match production contract" >&2
	exit 1
fi
if [[ "$client_host_port" != "3000" ]] ||
	[[ "$next_public_mode" != "production" ]] ||
	[[ "$next_public_site_url" != "https://winwidget.ru" ]] ||
	[[ "$next_public_production_host" != "https://api.winwidget.ru" ]] ||
	[[ "$next_public_api_url" != "https://api.winwidget.ru/api/v1" ]] ||
	[[ "$next_public_recaptcha_host" != "https://www.recaptcha.net" ]]; then
	echo "Frontend public production URLs or client port do not match the production contract" >&2
	exit 1
fi
if [[ ! "$jwt_clock_tolerance" =~ ^[0-9]+$ ]] ||
	((jwt_clock_tolerance > 60)); then
	echo "JWT_CLOCK_TOLERANCE_SECONDS must be between 0 and 60" >&2
	exit 1
fi
if [[ "$jwt_max_lifetime" != "900" ]]; then
	echo "JWT_MAX_TOKEN_LIFETIME_SECONDS must be 900 in production" >&2
	exit 1
fi

compose() {
	docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose config --quiet
compose build client
compose config --format json |
	docker run --rm -i --network none \
		-e APP_REVISION \
		-e APP_VERSION \
		--entrypoint node \
		"winwidget-client:$APP_VERSION" \
		-e '
		const config = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
		const services = config.services ?? {};
		if (config.name !== "winwidget") {
			throw new Error(`Unexpected Compose project name: ${config.name}`);
		}
		if (JSON.stringify(Object.keys(services).sort()) !== JSON.stringify(["client"])) {
			throw new Error("Frontend Compose must contain only the client service");
		}
		const client = services.client;
		const environment = client.environment ?? {};
		for (const key of [
			"JWT_JWKS_URL",
			"JWT_ISSUER",
			"JWT_AUDIENCE",
			"JWT_CLOCK_TOLERANCE_SECONDS",
			"JWT_MAX_TOKEN_LIFETIME_SECONDS",
		]) {
			if (!(key in environment) || environment[key] === "") {
				throw new Error(`Missing ${key} in frontend runtime environment`);
			}
		}
		for (const key of [
			"JWT_SECRET",
			"JWT_ACCESS_PRIVATE_KEY_BASE64",
			"JWT_ACCESS_JWKS_BASE64",
		]) {
			if (key in environment) {
				throw new Error(`Frontend must not receive ${key}`);
			}
		}
		if (client.build?.args?.APP_REVISION !== process.env.APP_REVISION) {
			throw new Error("Frontend image build revision is not pinned");
		}
		const expectedBuildArgs = {
			NEXT_PUBLIC_MODE: "production",
			NEXT_PUBLIC_SITE_URL: "https://winwidget.ru",
			NEXT_PUBLIC_PRODUCTION_HOST: "https://api.winwidget.ru",
			NEXT_PUBLIC_WIDGETS_HOST: "",
			NEXT_PUBLIC_API_URL: "https://api.winwidget.ru/api/v1",
			NEXT_PUBLIC_RECAPTCHA_HOST: "https://www.recaptcha.net",
		};
		for (const [key, value] of Object.entries(expectedBuildArgs)) {
			if (client.build?.args?.[key] !== value) {
				throw new Error(`Unexpected frontend build argument ${key}`);
			}
		}
		if (
			!client.build?.args?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
			client.build.args.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.startsWith("change_me")
		) {
			throw new Error("Frontend production reCAPTCHA site key is missing");
		}
		if (client.image !== `winwidget-client:${process.env.APP_VERSION}`) {
			throw new Error("Frontend image tag is not pinned to the revision");
		}
		const ports = Array.isArray(client.ports) ? client.ports : [];
		if (
			!ports.some(
				port =>
					port.host_ip === "127.0.0.1" &&
					String(port.published) === "3000" &&
					Number(port.target) === 3000,
			)
		) {
			throw new Error("Frontend port 3000 must bind only to 127.0.0.1");
		}
	'

compose up -d --no-build client

for ((attempt = 1; attempt <= HEALTHCHECK_ATTEMPTS; attempt++)); do
	if curl -fsS "$HEALTHCHECK_URL" > /dev/null; then
		break
	fi

	if ((attempt == HEALTHCHECK_ATTEMPTS)); then
		echo "Frontend healthcheck failed: $HEALTHCHECK_URL"
		compose logs --tail=100 client
		exit 1
	fi

	sleep "$HEALTHCHECK_INTERVAL"
done

container_id="$(compose ps -q client)"
if [[ -z "$container_id" ]]; then
	echo "Frontend container is not running" >&2
	exit 1
fi
image_revision="$(
	docker inspect "$container_id" \
		--format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
)"
if [[ "$image_revision" != "$APP_REVISION" ]]; then
	echo "Frontend image revision mismatch: expected $APP_REVISION, got $image_revision" >&2
	exit 1
fi

compose ps client
echo "Frontend revision verified: $APP_REVISION"
