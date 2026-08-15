#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/winwidget}"
client_root="${CLIENT_ROOT:-$APP_ROOT/winwidget.ru_client}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/deploy/frontend/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$client_root/deploy/docker-compose.prod.yml}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-30}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-2}"
identity_avatar_release_tool="$client_root/scripts/identity-avatar-client-release-evidence.mjs"
identity_avatar_log_soak_tool="$client_root/scripts/identity-avatar-client-log-soak.mjs"
identity_avatar_retarget_tool="$client_root/scripts/identity-avatar-client-soak-retarget.mjs"
identity_avatar_runtime_rebind_tool="$client_root/scripts/identity-avatar-client-runtime-rebind.mjs"
frontend_production_deploy_lock_tool="$client_root/scripts/frontend-production-deploy-lock.sh"
identity_avatar_image_full_manifest='/app/.identity-avatar-client-release/release-full-manifest-v1.json'
identity_avatar_release_root='/opt/winwidget/deploy/frontend/identity-avatar-client-release'
identity_avatar_signing_private='/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.private.pem'
identity_avatar_signing_public='/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.public.pem'
identity_avatar_backend_signing_transfer='/opt/winwidget/deploy/frontend/.identity-avatar-backend-signing.transfer.public.pem'
identity_avatar_backend_signing_public='/opt/winwidget/deploy/frontend/.identity-avatar-backend-signing.public.pem'
identity_avatar_backend_trust_bootstrap='/opt/winwidget/deploy/frontend/.identity-avatar-backend-trust-bootstrap-v1.json'
identity_avatar_backend_health_url='https://api.winwidget.ru/api/v1/health/deployment'
identity_avatar_backend_client_ready_url='https://api.winwidget.ru/.well-known/winwidget/identity-avatar-media/client-ready-v1.json'
identity_avatar_public_base='https://winwidget.ru/.well-known/winwidget/identity-avatar-client'
identity_avatar_nginx_config_source="$client_root/deploy/identity-avatar-client-log-soak.nginx.conf"
identity_avatar_nginx_config_target='/etc/nginx/conf.d/winwidget-identity-avatar-client-log-soak.conf'
identity_avatar_logrotate_source="$client_root/deploy/identity-avatar-client-log-soak.logrotate"
identity_avatar_logrotate_target='/etc/logrotate.d/winwidget-identity-avatar-client-log-soak'
identity_avatar_access_log='/var/log/nginx/winwidget.identity-avatar-client.access.log'
identity_avatar_soak_service='/etc/systemd/system/winwidget-identity-avatar-client-log-soak.service'
identity_avatar_soak_timer='/etc/systemd/system/winwidget-identity-avatar-client-log-soak.timer'
identity_avatar_soak_lock='/run/winwidget-identity-avatar-client-log-soak.lock'
identity_avatar_switch_receipt='/opt/winwidget/deploy/frontend/.identity-avatar-client-switch-v1.json'

deployment_mode='deploy'
case "$#" in
	0)
		;;
	1)
		case "$1" in
			--assert-avatar-cleanup-finalized)
				deployment_mode='assert-avatar-cleanup-finalized'
				;;
			--finalize-avatar-cleanup)
				deployment_mode='finalize-avatar-cleanup'
				;;
			*)
				echo 'Unknown frontend deployment command' >&2
				exit 1
				;;
		esac
		;;
	*)
		echo 'Frontend deployment accepts only one cleanup boundary command' >&2
		exit 1
		;;
esac

if [[ "$deployment_mode" == 'finalize-avatar-cleanup' ]]; then
	if [[ -z "${EXPECTED_REVISION+x}" ]]; then
		echo 'Cleanup boundary commands require an explicit EXPECTED_REVISION' >&2
		exit 1
	fi
	if [[ "${IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION:-}" != \
		"FINALIZE IDENTITY AVATAR CLIENT CLEANUP $EXPECTED_REVISION" ]]; then
		echo 'Cleanup finalization confirmation is invalid' >&2
		exit 1
	fi
fi

if [[ ! -f "$frontend_production_deploy_lock_tool" ||
	-L "$frontend_production_deploy_lock_tool" ]]; then
	echo 'Frontend production deploy lock tool is missing or is a symlink' >&2
	exit 1
fi
# shellcheck source=frontend-production-deploy-lock.sh
source "$frontend_production_deploy_lock_tool"
acquire_frontend_production_deploy_lock 'frontend deployment'

cd "$APP_ROOT"

deploy_revision="$(git -C "$client_root" rev-parse HEAD)"
if [[ "$deployment_mode" != 'deploy' &&
	-z "${EXPECTED_REVISION+x}" ]]; then
	echo 'Cleanup boundary commands require an explicit EXPECTED_REVISION' >&2
	exit 1
fi
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

identity_avatar_require_guard_tool() {
	local tool="$1"
	local label="$2"
	if [[ ! -f "$tool" || -L "$tool" ]]; then
		echo "$label is missing or is a symlink" >&2
		exit 1
	fi
}

identity_avatar_assert_signing_key_retained() {
	IDENTITY_AVATAR_SIGNING_PRIVATE="$identity_avatar_signing_private" \
		IDENTITY_AVATAR_SIGNING_PUBLIC="$identity_avatar_signing_public" node <<'NODE'
const { createPrivateKey, createPublicKey } = require('node:crypto');
const { lstatSync, readFileSync } = require('node:fs');
for (const [label, path] of [
  ['private', process.env.IDENTITY_AVATAR_SIGNING_PRIVATE],
  ['public', process.env.IDENTITY_AVATAR_SIGNING_PUBLIC],
]) {
  const metadata = lstatSync(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600 ||
    metadata.size < 1 ||
    metadata.size > 64 * 1024
  ) {
    throw new Error(`Frontend lifecycle ${label} key was not retained securely`);
  }
}
const privateKey = createPrivateKey(
  readFileSync(process.env.IDENTITY_AVATAR_SIGNING_PRIVATE),
);
const expectedPublic = createPublicKey(privateKey).export({
  type: 'spki',
  format: 'der',
});
const actualPublic = createPublicKey(
  readFileSync(process.env.IDENTITY_AVATAR_SIGNING_PUBLIC),
).export({ type: 'spki', format: 'der' });
if (!Buffer.from(expectedPublic).equals(Buffer.from(actualPublic))) {
  throw new Error('Frontend lifecycle signing key pair does not match');
}
NODE
}

identity_avatar_print_cleanup_finalize_instruction() {
	local cleanup_binding
	local cleanup_client_revision
	local cleanup_revision
	local cleanup_receipt_sha
	local cleanup_body_sha
	local cleanup_signature_sha
	cleanup_binding="$(
		node "$identity_avatar_release_tool" read-released-client-switch-binding
	)"
	read -r \
		cleanup_revision \
		cleanup_client_revision \
		cleanup_receipt_sha \
		cleanup_body_sha \
		cleanup_signature_sha <<<"$cleanup_binding"
	if [[ ! "$cleanup_client_revision" =~ ^[0-9a-f]{40}$ ]]; then
		echo 'Released client switch binding does not expose cleanupClientRevision' >&2
		return 1
	fi
	echo "Run directly on the VPS from exact frontend checkout $cleanup_client_revision: EXPECTED_REVISION=$cleanup_client_revision IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION=\"FINALIZE IDENTITY AVATAR CLIENT CLEANUP $cleanup_client_revision\" bash $client_root/scripts/deploy-production.sh --finalize-avatar-cleanup" >&2
}

identity_avatar_assert_retired_log_soak_state() {
	local finalization_missing='false'
	local load_state
	local active_state
	local enabled_state
	local nginx_active_state
	local retired_path
	local unit
	for unit in \
		winwidget-identity-avatar-client-log-soak.timer \
		winwidget-identity-avatar-client-log-soak.service; do
		load_state="$(
			systemctl show --property LoadState --value "$unit" 2>/dev/null || true
		)"
		active_state="$(systemctl is-active "$unit" 2>/dev/null || true)"
		enabled_state="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
		if [[ "$load_state" != 'not-found' ||
			"$active_state" != 'inactive' ||
			"$enabled_state" != 'not-found' ]]; then
			finalization_missing='true'
		fi
	done
	nginx_active_state="$(systemctl is-active nginx.service 2>/dev/null || true)"
	if [[ "$nginx_active_state" != 'active' ]]; then
		finalization_missing='true'
	fi
	for retired_path in \
		"$identity_avatar_soak_service" \
		"$identity_avatar_soak_timer" \
		"$identity_avatar_nginx_config_target" \
		"$identity_avatar_logrotate_target" \
		"$identity_avatar_soak_lock"; do
		if [[ -e "$retired_path" || -L "$retired_path" ]]; then
			finalization_missing='true'
		fi
	done
	if [[ "$finalization_missing" == 'true' ]]; then
		echo 'Retired frontend log-soak cleanup is not finalized; ordinary released deployment is read-only at this boundary.' >&2
		identity_avatar_print_cleanup_finalize_instruction
		return 1
	fi
}

identity_avatar_assert_retired_log_soak_finalized() {
	identity_avatar_assert_retired_log_soak_state
	if [[ "$(
		node "$identity_avatar_release_tool" verify-cleanup-finalization
	)" != 'finalized' ]]; then
		echo 'Signed frontend cleanup finalization proof is invalid' >&2
		identity_avatar_print_cleanup_finalize_instruction
		return 1
	fi
}

identity_avatar_remove_retired_log_soak() {
	local unit
	for unit in \
		winwidget-identity-avatar-client-log-soak.timer \
		winwidget-identity-avatar-client-log-soak.service; do
		if [[ "$(systemctl show --property LoadState --value "$unit" 2>/dev/null || true)" != 'not-found' ]]; then
			systemctl stop "$unit"
			if systemctl is-enabled --quiet "$unit"; then
				systemctl disable "$unit"
			fi
		fi
	done
	IDENTITY_AVATAR_SOAK_SERVICE="$identity_avatar_soak_service" \
		IDENTITY_AVATAR_SOAK_TIMER="$identity_avatar_soak_timer" \
		IDENTITY_AVATAR_NGINX_CONFIG="$identity_avatar_nginx_config_target" \
		IDENTITY_AVATAR_LOGROTATE_CONFIG="$identity_avatar_logrotate_target" \
		IDENTITY_AVATAR_SOAK_LOCK="$identity_avatar_soak_lock" node <<'NODE'
const { closeSync, fsyncSync, lstatSync, openSync, unlinkSync } = require('node:fs');
const { dirname } = require('node:path');
for (const path of [
  process.env.IDENTITY_AVATAR_SOAK_SERVICE,
  process.env.IDENTITY_AVATAR_SOAK_TIMER,
  process.env.IDENTITY_AVATAR_NGINX_CONFIG,
  process.env.IDENTITY_AVATAR_LOGROTATE_CONFIG,
  process.env.IDENTITY_AVATAR_SOAK_LOCK,
]) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o022) !== 0
  ) {
    throw new Error(`Retired frontend log-soak path is unsafe: ${path}`);
  }
  unlinkSync(path);
  const descriptor = openSync(dirname(path), 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
NODE
	systemctl daemon-reload
	nginx -t
	systemctl reload nginx.service
	if ! systemctl is-active --quiet nginx.service; then
		echo 'Nginx is not active after retired frontend log-soak reload' >&2
		exit 1
	fi
	identity_avatar_assert_retired_log_soak_state
}

identity_avatar_require_guard_tool \
	"$identity_avatar_release_tool" \
	'Identity avatar client release evidence tool'

identity_avatar_runtime_rebind_action="${IDENTITY_AVATAR_RUNTIME_REBIND_ACTION:-none}"
case "$identity_avatar_runtime_rebind_action" in
	none | stage-planned | stage-recovery | apply)
		;;
	*)
		echo 'Unknown frontend runtime rebind action' >&2
		exit 1
		;;
esac

if [[ "$deployment_mode" != 'deploy' &&
	"$identity_avatar_runtime_rebind_action" != 'none' ]]; then
	echo 'Cleanup boundary commands forbid frontend runtime rebind actions' >&2
	exit 1
fi

identity_avatar_switch_action="$(
	node "$identity_avatar_release_tool" client-switch-guard \
		--revision "$APP_REVISION" \
		--repository-root "$client_root"
)"

if [[ "$deployment_mode" != 'deploy' ]]; then
	if [[ "$identity_avatar_switch_action" != 'released' ]]; then
		echo 'Cleanup boundary commands require an already released signed receipt' >&2
		exit 1
	fi
	if [[ "$deployment_mode" == 'assert-avatar-cleanup-finalized' ]]; then
		identity_avatar_assert_signing_key_retained
		identity_avatar_assert_retired_log_soak_finalized
		identity_avatar_assert_signing_key_retained
		echo "Identity avatar frontend cleanup finalization verified for revision: $APP_REVISION"
		exit 0
	fi
	identity_avatar_release_binding_before="$(
		node "$identity_avatar_release_tool" read-released-client-switch-binding
	)"
	read -r \
		identity_avatar_cleanup_revision \
		identity_avatar_cleanup_client_revision \
		identity_avatar_cleanup_receipt_sha \
		identity_avatar_cleanup_body_sha \
		identity_avatar_cleanup_signature_sha <<<"$identity_avatar_release_binding_before"
	if [[ "$identity_avatar_cleanup_client_revision" != "$APP_REVISION" ]]; then
		echo 'Cleanup finalization must run from the exact cleanupClientRevision' >&2
		exit 1
	fi
	identity_avatar_assert_signing_key_retained
	identity_avatar_remove_retired_log_soak
	identity_avatar_assert_signing_key_retained
	identity_avatar_release_binding_after="$(
		node "$identity_avatar_release_tool" read-released-client-switch-binding
	)"
	if [[ "$identity_avatar_release_binding_after" != \
		"$identity_avatar_release_binding_before" ]]; then
		echo 'Released client switch binding changed during cleanup finalization' >&2
		exit 1
	fi
	if [[ "$(node "$identity_avatar_release_tool" write-cleanup-finalization)" != 'finalized' ]]; then
		echo 'Frontend cleanup finalization proof was not durably published' >&2
		exit 1
	fi
	echo "Identity avatar frontend cleanup finalized for revision: $APP_REVISION"
	exit 0
fi

if [[ "$identity_avatar_switch_action" != 'released' ]]; then
	identity_avatar_require_guard_tool \
		"$identity_avatar_retarget_tool" \
		'Identity avatar client retarget guard tool'
	if [[ -e "$identity_avatar_switch_receipt" ||
		-L "$identity_avatar_switch_receipt" ]]; then
		identity_avatar_switch_action="$(
			node "$identity_avatar_retarget_tool" guard \
				--revision "$APP_REVISION" \
				--repository-root "$client_root"
		)"
	fi
fi
case "$identity_avatar_switch_action" in
	cleanup-required)
		identity_avatar_switch_action="$(
			node "$identity_avatar_retarget_tool" prefetch-cleanup \
				--repository-root "$client_root"
		)"
		[[ "$identity_avatar_switch_action" == 'released' ]] || {
			echo 'Cleanup-complete prefetch did not release the client switch receipt' >&2
			exit 1
		}
		identity_avatar_switch_action="$(
			node "$identity_avatar_release_tool" client-switch-guard \
				--revision "$APP_REVISION" \
				--repository-root "$client_root"
		)"
		[[ "$identity_avatar_switch_action" == 'released' ]] || {
			echo 'Signed cleanup receipt did not release this frontend descendant' >&2
			exit 1
		}
		;;
	cleanup-released)
		identity_avatar_switch_action="$(
			node "$identity_avatar_release_tool" client-switch-guard \
				--revision "$APP_REVISION" \
				--repository-root "$client_root"
		)"
		[[ "$identity_avatar_switch_action" == 'released' ]] || {
			echo 'Signed cleanup receipt did not release this frontend descendant' >&2
			exit 1
		}
		;;
	initial | soak-pinned | retarget-staged | retarget-applied | released)
		;;
	*)
		echo 'Unknown identity avatar client switch guard state' >&2
		exit 1
		;;
esac

identity_avatar_cleanup_released='false'
if [[ "$identity_avatar_switch_action" == 'released' ]]; then
	identity_avatar_cleanup_released='true'
	if [[ "$identity_avatar_runtime_rebind_action" != 'none' ]]; then
		echo 'Frontend runtime rebind is forbidden after permanent avatar cleanup' >&2
		exit 1
	fi
fi

if [[ "$identity_avatar_cleanup_released" == 'true' ]]; then
	identity_avatar_assert_signing_key_retained
	identity_avatar_assert_retired_log_soak_finalized
	identity_avatar_assert_signing_key_retained
elif [[ "$identity_avatar_runtime_rebind_action" == 'none' &&
	"$identity_avatar_switch_action" =~ ^(soak-pinned|retarget-applied)$ ]]; then
	echo "Frontend revision $APP_REVISION is already pinned for the Identity avatar soak; deployment is deferred without runtime mutation."
	exit 0
fi

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

if [[ "$identity_avatar_cleanup_released" != 'true' ]]; then
	for required_file in \
		"$identity_avatar_log_soak_tool" \
		"$identity_avatar_runtime_rebind_tool" \
		"$frontend_production_deploy_lock_tool" \
		"$identity_avatar_nginx_config_source" \
		"$identity_avatar_logrotate_source"; do
		if [[ ! -f "$required_file" || -L "$required_file" ]]; then
			echo "Identity avatar client log-soak deploy file is missing or is a symlink: $required_file" >&2
			exit 1
		fi
	done
fi

if [[ "$identity_avatar_runtime_rebind_action" =~ ^stage-(planned|recovery)$ ]]; then
	stage_container_id="$(compose ps -q client)"
	if [[ -z "$stage_container_id" ]]; then
		echo 'Frontend runtime rebind PREPARED requires the live client container' >&2
		exit 1
	fi
	stage_live_revision="$(
		docker inspect "$stage_container_id" \
			--format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
	)"
	stage_live_image="$(docker inspect "$stage_container_id" --format '{{ .Image }}')"
	if [[ "$stage_live_revision" != "$APP_REVISION" ]] ||
		[[ ! "$stage_live_image" =~ ^sha256:[0-9a-f]{64}$ ]]; then
		echo 'Frontend runtime rebind PREPARED live image identity is invalid' >&2
		exit 1
	fi
	stage_mode='planned-restart'
	if [[ "$identity_avatar_runtime_rebind_action" == 'stage-recovery' ]]; then
		stage_mode='recovery-adoption'
	fi
	read -r \
		stage_generation \
		stage_body_sha \
		stage_signature_sha <<<"$(
		node "$identity_avatar_runtime_rebind_tool" stage-live \
			--revision "$APP_REVISION" \
			--mode "$stage_mode" \
			--live-image-id "$stage_live_image" \
			--repository-root "$client_root"
	)"
	if [[ ! "$stage_generation" =~ ^([1-9]|[1-5][0-9]|6[0-4])$ ]] ||
		[[ ! "$stage_body_sha" =~ ^[0-9a-f]{64}$ ]] ||
		[[ ! "$stage_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
		echo 'Frontend runtime rebind PREPARED output is invalid' >&2
		exit 1
	fi
	echo "identity_avatar_client_runtime_rebind_generation=$stage_generation"
	echo "identity_avatar_client_runtime_rebind_prepared_sha256=$stage_body_sha"
	echo "identity_avatar_client_runtime_rebind_prepared_signature_sha256=$stage_signature_sha"
	exit 0
fi

if [[ "$identity_avatar_cleanup_released" != 'true' &&
	-L "$identity_avatar_release_root" ]]; then
	echo 'Identity avatar client release evidence root must not be a symlink' >&2
	exit 1
fi
if [[ "$identity_avatar_cleanup_released" != 'true' ]]; then
	install -d -o root -g root -m 0755 "$identity_avatar_release_root"
IDENTITY_AVATAR_RELEASE_ROOT="$identity_avatar_release_root" node <<'NODE'
const { lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const root = process.env.IDENTITY_AVATAR_RELEASE_ROOT;
const metadata = lstatSync(root);
if (
  realpathSync(root) !== resolve(root) ||
  !metadata.isDirectory() ||
  metadata.isSymbolicLink() ||
  metadata.uid !== 0 ||
  metadata.gid !== 0 ||
  (metadata.mode & 0o022) !== 0
) {
  throw new Error('Identity avatar client release evidence root is not secure');
}
NODE
fi

identity_avatar_image_adoption="$identity_avatar_release_root/.image-adoption-${APP_REVISION}-v1.json"
identity_avatar_reuse_adopted_image='false'
identity_avatar_adopted_image_id=''
if [[ "$identity_avatar_cleanup_released" != 'true' &&
	( -e "$identity_avatar_image_adoption" || -L "$identity_avatar_image_adoption" ) ]]; then
	identity_avatar_adopted_image_id="$(
		node "$identity_avatar_release_tool" read-adopted-image-id \
			--journal "$identity_avatar_image_adoption" \
			--revision "$APP_REVISION"
	)"
	if ! docker image inspect "$identity_avatar_adopted_image_id" >/dev/null 2>&1; then
		echo 'The first adopted image for this client revision is no longer available' >&2
		echo 'Use a new immutable client revision; rebuilding this revision would change its evidence' >&2
		exit 1
	fi
	identity_avatar_reuse_adopted_image='true'
fi

identity_avatar_runtime_rebind_generation=''
identity_avatar_runtime_rebind_mode=''
identity_avatar_runtime_rebind_expected_image=''
identity_avatar_runtime_rebind_previous_process=''
identity_avatar_runtime_rebind_ready_sha=''
identity_avatar_runtime_rebind_prepared_observed_process=''
identity_avatar_runtime_rebind_observed_process=''
identity_avatar_runtime_rebind_expected_process=''
identity_avatar_runtime_rebind_local_state=''
identity_avatar_runtime_rebind_expected_container_generation=''
identity_avatar_runtime_rebind_mutation_sha='absent'
identity_avatar_runtime_rebind_mutation_signature_sha='absent'
if [[ "$identity_avatar_cleanup_released" != 'true' &&
	"$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	if [[ "$identity_avatar_reuse_adopted_image" != 'true' ]]; then
		echo 'Frontend runtime rebind requires the exact previously adopted image' >&2
		exit 1
	fi
	read -r \
		identity_avatar_runtime_rebind_generation \
		identity_avatar_runtime_rebind_mode \
		identity_avatar_runtime_rebind_expected_image \
		identity_avatar_runtime_rebind_previous_process \
		identity_avatar_runtime_rebind_ready_sha \
		identity_avatar_runtime_rebind_prepared_observed_process \
		identity_avatar_runtime_rebind_observed_process \
		identity_avatar_runtime_rebind_local_state \
		identity_avatar_runtime_rebind_mutation_sha \
		identity_avatar_runtime_rebind_mutation_signature_sha <<<"$(
		node "$identity_avatar_runtime_rebind_tool" archive-ready-live \
			--revision "$APP_REVISION"
	)"
	if [[ ! "$identity_avatar_runtime_rebind_generation" =~ ^([1-9]|[1-5][0-9]|6[0-4])$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_mode" =~ ^(planned-restart|recovery-adoption)$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_expected_image" =~ ^sha256:[0-9a-f]{64}$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_previous_process" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] ||
		[[ ! "$identity_avatar_runtime_rebind_ready_sha" =~ ^[0-9a-f]{64}$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_prepared_observed_process" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] ||
		[[ ! "$identity_avatar_runtime_rebind_observed_process" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] ||
		[[ ! "$identity_avatar_runtime_rebind_local_state" =~ ^(prepared|adopted)$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_mutation_sha" =~ ^(absent|[0-9a-f]{64})$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_mutation_signature_sha" =~ ^(absent|[0-9a-f]{64})$ ]] ||
		[[ "$identity_avatar_runtime_rebind_mutation_sha" == 'absent' && "$identity_avatar_runtime_rebind_mutation_signature_sha" != 'absent' ]] ||
		[[ "$identity_avatar_runtime_rebind_mutation_sha" != 'absent' && "$identity_avatar_runtime_rebind_mutation_signature_sha" == 'absent' ]] ||
		[[ "$identity_avatar_runtime_rebind_mode" == 'recovery-adoption' && "$identity_avatar_runtime_rebind_mutation_sha" != 'absent' ]] ||
		[[ "$identity_avatar_runtime_rebind_expected_image" != "$identity_avatar_adopted_image_id" ]]; then
		echo 'Frontend runtime rebind READY output is invalid' >&2
		exit 1
	fi
	if [[ "$identity_avatar_runtime_rebind_local_state" == 'adopted' ]]; then
		identity_avatar_runtime_rebind_expected_process="$identity_avatar_runtime_rebind_observed_process"
	fi
	if ! systemctl stop \
		winwidget-identity-avatar-client-log-soak.timer \
		winwidget-identity-avatar-client-log-soak.service; then
		echo 'Frontend runtime rebind could not fence the previous soak timer' >&2
		exit 1
	fi
fi

IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION=0
if [[ "$identity_avatar_cleanup_released" != 'true' &&
	"$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION="$identity_avatar_runtime_rebind_generation"
fi
export IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION

if [[ "$identity_avatar_reuse_adopted_image" == 'true' ]]; then
	docker image tag \
		"$identity_avatar_adopted_image_id" \
		"winwidget-client:$APP_VERSION"
fi

compose config --quiet
if [[ "$identity_avatar_reuse_adopted_image" != 'true' ]]; then
	compose build client
fi
compose config --format json |
		docker run --rm -i --network none \
			-e APP_REVISION \
			-e APP_VERSION \
			-e IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION \
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
			if (
				client.labels?.["ru.winwidget.identity-avatar.runtime-stability-generation"] !==
				process.env.IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION
			) {
				throw new Error("Frontend runtime stability generation label is not pinned");
			}
		const volumes = Array.isArray(client.volumes) ? client.volumes : [];
		if (
			volumes.length !== 1 ||
			volumes[0].type !== "bind" ||
			volumes[0].source !== "/opt/winwidget/deploy/frontend/identity-avatar-client-release" ||
			volumes[0].target !== "/run/winwidget/identity-avatar-client-release" ||
			volumes[0].read_only !== true
		) {
			throw new Error("Frontend release evidence must use the exact read-only bind mount");
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

if [[ "$identity_avatar_cleanup_released" == 'true' ]]; then
	identity_avatar_image_id="$(
		docker image inspect "winwidget-client:$APP_VERSION" --format '{{ .Id }}'
	)"
	if [[ ! "$identity_avatar_image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
		echo 'Released frontend build did not produce an immutable image ID' >&2
		exit 1
	fi
	compose up -d --no-build client
	for ((attempt = 1; attempt <= HEALTHCHECK_ATTEMPTS; attempt++)); do
		if curl -fsS "$HEALTHCHECK_URL" >/dev/null; then
			break
		fi
		if ((attempt == HEALTHCHECK_ATTEMPTS)); then
			echo "Frontend healthcheck failed: $HEALTHCHECK_URL" >&2
			compose logs --tail=100 client
			exit 1
		fi
		sleep "$HEALTHCHECK_INTERVAL"
	done
	released_container_id="$(compose ps -q client)"
	if [[ -z "$released_container_id" ]]; then
		echo 'Released frontend container is not running' >&2
		exit 1
	fi
	released_container_image="$(
		docker inspect "$released_container_id" --format '{{ .Image }}'
	)"
	released_container_revision="$(
		docker inspect "$released_container_id" \
			--format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
	)"
	if [[ "$released_container_image" != "$identity_avatar_image_id" ||
		"$released_container_revision" != "$APP_REVISION" ]]; then
		echo 'Released frontend container does not match the pinned build' >&2
		exit 1
	fi
	released_served_revision="$(
		curl -fsSI "$HEALTHCHECK_URL" | awk -F ': ' '
			tolower($1) == "x-winwidget-revision" {
				value = $2
				sub(/\r$/, "", value)
				print value
				exit
			}
		'
	)"
	if [[ "$released_served_revision" != "$APP_REVISION" ]]; then
		echo 'Released frontend HTTP revision header mismatch' >&2
		exit 1
	fi
	identity_avatar_assert_signing_key_retained
	compose ps client
	echo "Frontend revision verified after permanent avatar cleanup: $APP_REVISION"
	exit 0
fi

node "$identity_avatar_release_tool" provision-signing-key \
	--private-key "$identity_avatar_signing_private" \
	--public-key "$identity_avatar_signing_public"
node "$identity_avatar_release_tool" bootstrap-backend-trust \
	--revision "$APP_REVISION" \
	--repository-root "$client_root"

for trust_path in \
	"$identity_avatar_backend_signing_public" \
	"$identity_avatar_backend_trust_bootstrap"; do
	if [[ ! -f "$trust_path" || -L "$trust_path" ]] ||
		[[ "$(stat -c '%u:%g:%a:%h' "$trust_path")" != '0:0:600:1' ]]; then
		echo "Identity avatar backend trust artifact is not root-owned 0600: $trust_path" >&2
		exit 1
	fi
done
if [[ -e "$identity_avatar_backend_signing_transfer" || -L "$identity_avatar_backend_signing_transfer" ]]; then
	echo 'Identity avatar backend public-key transfer was not durably consumed' >&2
	exit 1
fi

identity_avatar_work_dir="$(mktemp -d)"
identity_avatar_extract_container=''
identity_avatar_cleanup_temporary() {
	if [[ -n "$identity_avatar_extract_container" ]]; then
		docker rm -f "$identity_avatar_extract_container" >/dev/null 2>&1 || true
	fi
	rm -rf -- "$identity_avatar_work_dir"
}
trap identity_avatar_cleanup_temporary EXIT

identity_avatar_local_manifest="$identity_avatar_work_dir/release-evidence-v1.json"
identity_avatar_local_full_manifest="$identity_avatar_work_dir/release-full-manifest-v1.json"
identity_avatar_local_signature="$identity_avatar_work_dir/release-evidence-v1.json.sig"
identity_avatar_extract_container="$(docker create "winwidget-client:$APP_VERSION")"
docker cp \
	"$identity_avatar_extract_container:$identity_avatar_image_full_manifest" \
	"$identity_avatar_local_full_manifest"
docker rm "$identity_avatar_extract_container" >/dev/null
identity_avatar_extract_container=''

node "$identity_avatar_release_tool" derive-release \
	--full-manifest "$identity_avatar_local_full_manifest" \
	--revision "$APP_REVISION" \
	--output "$identity_avatar_local_manifest"

identity_avatar_image_id="$(
	docker image inspect "winwidget-client:$APP_VERSION" --format '{{ .Id }}'
)"
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]] &&
	[[ "$identity_avatar_image_id" != "$identity_avatar_runtime_rebind_expected_image" ]]; then
	echo 'Frontend runtime rebind image changed after READY validation' >&2
	exit 1
fi
node "$identity_avatar_release_tool" adopt-image \
	--journal "$identity_avatar_image_adoption" \
	--revision "$APP_REVISION" \
	--image-id "$identity_avatar_image_id" \
	--full-manifest "$identity_avatar_local_full_manifest" \
	--release-evidence "$identity_avatar_local_manifest"

node "$identity_avatar_release_tool" sign-release \
	--manifest "$identity_avatar_local_manifest" \
	--private-key "$identity_avatar_signing_private" \
	--public-key "$identity_avatar_signing_public" \
	--revision "$APP_REVISION" \
	--signature "$identity_avatar_local_signature"
node "$identity_avatar_release_tool" verify-release \
	--manifest "$identity_avatar_local_manifest" \
	--signature "$identity_avatar_local_signature" \
	--public-key "$identity_avatar_signing_public" \
	--revision "$APP_REVISION"

identity_avatar_release_sha="$(sha256sum "$identity_avatar_local_manifest" | awk '{ print $1 }')"
identity_avatar_full_manifest_sha="$(sha256sum "$identity_avatar_local_full_manifest" | awk '{ print $1 }')"
identity_avatar_signature_sha="$(sha256sum "$identity_avatar_local_signature" | awk '{ print $1 }')"
if [[ ! "$identity_avatar_release_sha" =~ ^[0-9a-f]{64}$ ]] ||
	[[ ! "$identity_avatar_full_manifest_sha" =~ ^[0-9a-f]{64}$ ]] ||
	[[ ! "$identity_avatar_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
	echo 'Identity avatar client release evidence hashes are invalid' >&2
	exit 1
fi

install -d -o root -g root -m 0755 "$identity_avatar_release_root"
IDENTITY_AVATAR_RELEASE_ROOT="$identity_avatar_release_root" node <<'NODE'
const { lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const root = process.env.IDENTITY_AVATAR_RELEASE_ROOT;
const metadata = lstatSync(root);
if (
  realpathSync(root) !== resolve(root) ||
  !metadata.isDirectory() ||
  metadata.isSymbolicLink() ||
  metadata.uid !== 0 ||
  metadata.gid !== 0 ||
  (metadata.mode & 0o022) !== 0
) {
  throw new Error('Identity avatar client release evidence root is not secure');
}
NODE

identity_avatar_release_directory="$identity_avatar_release_root/$APP_REVISION"
if [[ -e "$identity_avatar_release_directory" || -L "$identity_avatar_release_directory" ]]; then
	if [[ ! -d "$identity_avatar_release_directory" || -L "$identity_avatar_release_directory" ]]; then
		echo 'Existing identity avatar client release path is not a real directory' >&2
		exit 1
	fi
	cmp -s \
		"$identity_avatar_local_full_manifest" \
		"$identity_avatar_release_directory/release-full-manifest-v1.json" || {
		echo 'Root-only identity avatar client full manifest already differs' >&2
		exit 1
	}
	cmp -s \
		"$identity_avatar_local_manifest" \
		"$identity_avatar_release_directory/release-evidence-v1.json" || {
		echo 'Immutable identity avatar client release evidence body already differs' >&2
		exit 1
	}
	cmp -s \
		"$identity_avatar_local_signature" \
		"$identity_avatar_release_directory/release-evidence-v1.json.sig" || {
		echo 'Immutable identity avatar client release evidence signature already differs' >&2
		exit 1
	}
else
	identity_avatar_release_stage="$(
		mktemp -d "$identity_avatar_release_root/.${APP_REVISION}.stage.XXXXXX"
	)"
	install -o root -g root -m 0600 \
		"$identity_avatar_local_full_manifest" \
		"$identity_avatar_release_stage/release-full-manifest-v1.json"
	install -o root -g root -m 0644 \
		"$identity_avatar_local_manifest" \
		"$identity_avatar_release_stage/release-evidence-v1.json"
	install -o root -g root -m 0644 \
		"$identity_avatar_local_signature" \
		"$identity_avatar_release_stage/release-evidence-v1.json.sig"
	chmod 0755 "$identity_avatar_release_stage"
	IDENTITY_AVATAR_RELEASE_STAGE="$identity_avatar_release_stage" \
		IDENTITY_AVATAR_RELEASE_DIRECTORY="$identity_avatar_release_directory" \
		node <<'NODE'
const { renameSync } = require('node:fs');
renameSync(
  process.env.IDENTITY_AVATAR_RELEASE_STAGE,
  process.env.IDENTITY_AVATAR_RELEASE_DIRECTORY,
);
NODE
fi

IDENTITY_AVATAR_RELEASE_DIRECTORY="$identity_avatar_release_directory" \
	IDENTITY_AVATAR_EXPECTED_FULL_SHA="$identity_avatar_full_manifest_sha" \
	IDENTITY_AVATAR_EXPECTED_RELEASE_SHA="$identity_avatar_release_sha" \
	IDENTITY_AVATAR_EXPECTED_SIGNATURE_SHA="$identity_avatar_signature_sha" node <<'NODE'
const { createHash } = require('node:crypto');
const { closeSync, fsyncSync, lstatSync, openSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
for (const [name, mode, expectedSha] of [
  ['release-full-manifest-v1.json', 0o600, process.env.IDENTITY_AVATAR_EXPECTED_FULL_SHA],
  ['release-evidence-v1.json', 0o644, process.env.IDENTITY_AVATAR_EXPECTED_RELEASE_SHA],
  ['release-evidence-v1.json.sig', 0o644, process.env.IDENTITY_AVATAR_EXPECTED_SIGNATURE_SHA],
]) {
  const path = join(process.env.IDENTITY_AVATAR_RELEASE_DIRECTORY, name);
  const metadata = lstatSync(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== mode ||
    createHash('sha256').update(readFileSync(path)).digest('hex') !== expectedSha
  ) {
    throw new Error(`Identity avatar client release artifact is not secure: ${name}`);
  }
  const descriptor = openSync(path, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
for (const directory of [
  process.env.IDENTITY_AVATAR_RELEASE_DIRECTORY,
  dirname(process.env.IDENTITY_AVATAR_RELEASE_DIRECTORY),
]) {
  const directoryDescriptor = openSync(directory, 'r');
  try {
    fsyncSync(directoryDescriptor);
  } finally {
    closeSync(directoryDescriptor);
  }
}
NODE

node "$identity_avatar_release_tool" verify-release \
	--manifest "$identity_avatar_release_directory/release-evidence-v1.json" \
	--signature "$identity_avatar_release_directory/release-evidence-v1.json.sig" \
	--public-key "$identity_avatar_signing_public" \
	--revision "$APP_REVISION"

identity_avatar_fsync_managed_path() {
	IDENTITY_AVATAR_MANAGED_PATH="$1" node <<'NODE'
const { closeSync, fsyncSync, openSync } = require('node:fs');
const { dirname } = require('node:path');
for (const path of [process.env.IDENTITY_AVATAR_MANAGED_PATH, dirname(process.env.IDENTITY_AVATAR_MANAGED_PATH)]) {
  const descriptor = openSync(path, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
NODE
}

identity_avatar_assert_managed_config() {
	IDENTITY_AVATAR_MANAGED_PATH="$1" node <<'NODE'
const { lstatSync } = require('node:fs');
const metadata = lstatSync(process.env.IDENTITY_AVATAR_MANAGED_PATH);
if (
  !metadata.isFile() ||
  metadata.isSymbolicLink() ||
  metadata.nlink !== 1 ||
  metadata.uid !== 0 ||
  metadata.gid !== 0 ||
  (metadata.mode & 0o777) !== 0o644 ||
  metadata.size <= 0 ||
  metadata.size > 64 * 1024
) {
  throw new Error('Managed identity avatar log configuration is not root-owned 0644');
}
NODE
}

identity_avatar_managed_backup=''
identity_avatar_install_managed_config() {
	local source="$1"
	local target="$2"
	local target_directory
	local target_name
	local stage

	target_directory="$(dirname "$target")"
	target_name="$(basename "$target")"
	if [[ ! -d "$target_directory" || -L "$target_directory" ]]; then
		echo "Managed configuration directory is missing or unsafe: $target_directory" >&2
		exit 1
	fi
	IDENTITY_AVATAR_MANAGED_DIRECTORY="$target_directory" node <<'NODE'
const { lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const path = process.env.IDENTITY_AVATAR_MANAGED_DIRECTORY;
const metadata = lstatSync(path);
if (
  realpathSync(path) !== resolve(path) ||
  !metadata.isDirectory() ||
  metadata.isSymbolicLink() ||
  metadata.uid !== 0 ||
  metadata.gid !== 0 ||
  (metadata.mode & 0o022) !== 0
) {
  throw new Error('Managed identity avatar configuration directory is unsafe');
}
NODE
	identity_avatar_managed_backup=''
	if [[ -e "$target" || -L "$target" ]]; then
		identity_avatar_assert_managed_config "$target"
		identity_avatar_managed_backup="$(mktemp "$target_directory/.${target_name}.backup.XXXXXX")"
		cp --preserve=mode,ownership,timestamps -- "$target" "$identity_avatar_managed_backup"
	fi
	stage="$(mktemp "$target_directory/.${target_name}.stage.XXXXXX")"
	install -o root -g root -m 0644 -- "$source" "$stage"
	mv -fT -- "$stage" "$target"
	identity_avatar_assert_managed_config "$target"
	identity_avatar_fsync_managed_path "$target"
}

identity_avatar_restore_managed_config() {
	local target="$1"
	local backup="$2"
	if [[ -n "$backup" ]]; then
		mv -fT -- "$backup" "$target"
		identity_avatar_assert_managed_config "$target"
		identity_avatar_fsync_managed_path "$target"
	else
		rm -f -- "$target"
		IDENTITY_AVATAR_MANAGED_DIRECTORY="$(dirname "$target")" node <<'NODE'
const { closeSync, fsyncSync, openSync } = require('node:fs');
const descriptor = openSync(process.env.IDENTITY_AVATAR_MANAGED_DIRECTORY, 'r');
try {
  fsyncSync(descriptor);
} finally {
  closeSync(descriptor);
}
NODE
	fi
}

node "$identity_avatar_log_soak_tool" prepare-access-log \
	--path "$identity_avatar_access_log"

identity_avatar_install_managed_config \
	"$identity_avatar_logrotate_source" \
	"$identity_avatar_logrotate_target"
identity_avatar_logrotate_backup="$identity_avatar_managed_backup"
if ! logrotate --debug "$identity_avatar_logrotate_target" >/dev/null 2>&1; then
	identity_avatar_restore_managed_config \
		"$identity_avatar_logrotate_target" \
		"$identity_avatar_logrotate_backup"
	echo 'Identity avatar client logrotate policy validation failed' >&2
	exit 1
fi
if [[ -n "$identity_avatar_logrotate_backup" ]]; then
	rm -f -- "$identity_avatar_logrotate_backup"
fi

identity_avatar_install_managed_config \
	"$identity_avatar_nginx_config_source" \
	"$identity_avatar_nginx_config_target"
identity_avatar_nginx_backup="$identity_avatar_managed_backup"
if ! nginx -t >/dev/null 2>&1; then
	identity_avatar_restore_managed_config \
		"$identity_avatar_nginx_config_target" \
		"$identity_avatar_nginx_backup"
	nginx -t >/dev/null 2>&1
	echo 'Identity avatar client selective Nginx log configuration validation failed' >&2
	exit 1
fi
if ! systemctl reload nginx.service; then
	identity_avatar_restore_managed_config \
		"$identity_avatar_nginx_config_target" \
		"$identity_avatar_nginx_backup"
	nginx -t >/dev/null 2>&1
	systemctl reload nginx.service
	echo 'Identity avatar client selective Nginx log configuration reload failed' >&2
	exit 1
fi
if [[ -n "$identity_avatar_nginx_backup" ]]; then
	rm -f -- "$identity_avatar_nginx_backup"
fi

cmp -s "$identity_avatar_nginx_config_source" "$identity_avatar_nginx_config_target" || {
	echo 'Installed identity avatar Nginx log configuration differs from source' >&2
	exit 1
}
cmp -s "$identity_avatar_logrotate_source" "$identity_avatar_logrotate_target" || {
	echo 'Installed identity avatar logrotate policy differs from source' >&2
	exit 1
}
logrotate --force "$identity_avatar_logrotate_target"
node "$identity_avatar_log_soak_tool" prepare-access-log \
	--path "$identity_avatar_access_log"

identity_avatar_header_value() {
	local headers_path="$1"
	local header_name="$2"
	awk -F ': *' -v expected="${header_name,,}" '
		tolower($1) == expected {
			value = $2
			sub(/\r$/, "", value)
			print value
			exit
		}
	' "$headers_path"
}

identity_avatar_assert_no_redirect() {
	local headers_path="$1"
	if awk -F ': *' 'tolower($1) == "location" { found = 1 } END { exit(found ? 0 : 1) }' \
		"$headers_path"; then
		echo 'Identity avatar backend activation proof must not redirect' >&2
		exit 1
	fi
}

identity_avatar_fetch_backend_health() {
	local body_path="$1"
	local headers_path="$2"
	local http_status
	local cache_control

	http_status="$(
		curl --proto '=https' --tlsv1.2 \
			--connect-timeout 10 --max-time 30 --max-filesize 65536 \
			--max-redirs 0 -sS -D "$headers_path" -o "$body_path" \
			-w '%{http_code}' "$identity_avatar_backend_health_url"
	)"
	if [[ "$http_status" != '200' ]]; then
		echo "Backend deployment health returned HTTP $http_status" >&2
		exit 1
	fi
	identity_avatar_assert_no_redirect "$headers_path"
	cache_control="$(identity_avatar_header_value "$headers_path" 'cache-control')"
	if [[ ! "${cache_control,,}" =~ (^|,[[:space:]]*)no-store([[:space:]]*,|$) ]]; then
		echo 'Backend deployment health must be explicitly no-store' >&2
		exit 1
	fi
}

identity_avatar_fetch_backend_signed_artifact() {
	local url="$1"
	local body_path="$2"
	local headers_path="$3"
	local expected_content_type="$4"
	local expected_revision="$5"
	local http_status
	local response_revision
	local cache_control
	local cache_control_normalized
	local content_type
	local nosniff

	http_status="$(
		curl --proto '=https' --tlsv1.2 \
			--connect-timeout 10 --max-time 30 --max-filesize 65536 \
			--max-redirs 0 -sS -D "$headers_path" -o "$body_path" \
			-w '%{http_code}' "$url"
	)"
	if [[ "$http_status" != '200' ]]; then
		echo "Backend signed identity-avatar attestation returned HTTP $http_status" >&2
		exit 1
	fi
	identity_avatar_assert_no_redirect "$headers_path"
	response_revision="$(identity_avatar_header_value "$headers_path" 'x-winwidget-revision')"
	cache_control="$(identity_avatar_header_value "$headers_path" 'cache-control')"
	cache_control_normalized="$(printf '%s' "${cache_control,,}" | tr -d '[:space:]')"
	content_type="$(identity_avatar_header_value "$headers_path" 'content-type')"
	nosniff="$(identity_avatar_header_value "$headers_path" 'x-content-type-options')"
	if { [[ "$expected_revision" == 'discover' ]] &&
		[[ ! "$response_revision" =~ ^[0-9a-f]{40}$ ]]; } ||
		{ [[ "$expected_revision" != 'discover' ]] &&
			[[ "$response_revision" != "$expected_revision" ]]; } ||
		{ [[ "$cache_control_normalized" != 'no-store,max-age=0' ]] &&
			[[ "$cache_control_normalized" != 'max-age=0,no-store' ]]; } ||
		[[ "$content_type" != "$expected_content_type" ]] ||
		[[ "${nosniff,,}" != 'nosniff' ]]; then
		echo 'Backend signed identity-avatar headers do not match the frozen contract' >&2
		exit 1
	fi
}

identity_avatar_verify_backend_activation() {
	local health_first="$identity_avatar_work_dir/backend-health-first.json"
	local health_second="$identity_avatar_work_dir/backend-health-second.json"
	local ready_first="$identity_avatar_work_dir/backend-client-ready-first.json"
	local ready_second="$identity_avatar_work_dir/backend-client-ready-second.json"
	local ready_signature="$identity_avatar_work_dir/backend-client-ready.json.sig"
	local live_revision_first
	local live_revision_second

	identity_avatar_fetch_backend_health \
		"$health_first" \
		"$identity_avatar_work_dir/backend-health-first.headers"
	live_revision_first="$(
		node "$identity_avatar_release_tool" read-backend-deployment-revision \
			--health "$health_first"
	)"
	if [[ ! "$live_revision_first" =~ ^[0-9a-f]{40}$ ]]; then
		echo 'Backend deployment health returned an invalid revision' >&2
		exit 1
	fi

	identity_avatar_fetch_backend_signed_artifact \
		"$identity_avatar_backend_client_ready_url" \
		"$ready_first" \
		"$identity_avatar_work_dir/backend-client-ready-first.headers" \
		'application/json; charset=utf-8' \
		"$live_revision_first"
	identity_avatar_fetch_backend_signed_artifact \
		"${identity_avatar_backend_client_ready_url}.sig" \
		"$ready_signature" \
		"$identity_avatar_work_dir/backend-client-ready-signature.headers" \
		'application/octet-stream' \
		"$live_revision_first"
	identity_avatar_fetch_backend_signed_artifact \
		"$identity_avatar_backend_client_ready_url" \
		"$ready_second" \
		"$identity_avatar_work_dir/backend-client-ready-second.headers" \
		'application/json; charset=utf-8' \
		"$live_revision_first"
	cmp -s "$ready_first" "$ready_second" || {
		echo 'Backend client-ready body changed while its detached signature was fetched' >&2
		exit 1
	}
	node "$identity_avatar_release_tool" verify-backend-client-ready \
		--attestation "$ready_first" \
		--signature "$ready_signature" \
		--public-key "$identity_avatar_backend_signing_public" \
		--server-revision "$live_revision_first"

	identity_avatar_fetch_backend_health \
		"$health_second" \
		"$identity_avatar_work_dir/backend-health-second.headers"
	live_revision_second="$(
		node "$identity_avatar_release_tool" read-backend-deployment-revision \
			--health "$health_second"
	)"
	if [[ "$live_revision_second" != "$live_revision_first" ]]; then
		echo 'Backend revision changed during client-ready activation verification' >&2
		exit 1
	fi
	identity_avatar_backend_client_ready_sha="$(sha256sum "$ready_first" | awk '{ print $1 }')"
	identity_avatar_backend_client_ready_signature_sha="$(sha256sum "$ready_signature" | awk '{ print $1 }')"
	if [[ ! "$identity_avatar_backend_client_ready_sha" =~ ^[0-9a-f]{64}$ ]] ||
		[[ ! "$identity_avatar_backend_client_ready_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
		echo 'Backend client-ready activation hashes are invalid' >&2
		exit 1
	fi
	identity_avatar_backend_server_revision="$live_revision_first"
	identity_avatar_backend_client_ready_file="$ready_first"
	identity_avatar_backend_client_ready_signature_file="$ready_signature"
}

identity_avatar_backend_server_revision=''
identity_avatar_backend_client_ready_sha=''
identity_avatar_backend_client_ready_signature_sha=''
identity_avatar_backend_client_ready_file=''
identity_avatar_backend_client_ready_signature_file=''
if [[ -e "$identity_avatar_switch_receipt" || -L "$identity_avatar_switch_receipt" ]]; then
	identity_avatar_switch_action="$(
		node "$identity_avatar_retarget_tool" guard \
			--revision "$APP_REVISION" \
			--repository-root "$client_root"
	)"
else
	identity_avatar_switch_action="$(
		node "$identity_avatar_release_tool" client-switch-guard \
			--revision "$APP_REVISION" \
			--repository-root "$client_root"
	)"
fi
case "$identity_avatar_switch_action" in
	initial)
		identity_avatar_verify_backend_activation
		;;
	soak-pinned | retarget-staged | retarget-applied | released)
		;;
	cleanup-required | cleanup-released)
		identity_avatar_switch_action="$(
			node "$identity_avatar_release_tool" client-switch-guard \
				--revision "$APP_REVISION" \
				--repository-root "$client_root"
		)"
		if [[ "$identity_avatar_switch_action" == 'cleanup-required' ]]; then
			identity_avatar_switch_action="$(
				node "$identity_avatar_retarget_tool" prefetch-cleanup \
					--repository-root "$client_root"
			)"
		fi
		if [[ "$identity_avatar_switch_action" != 'released' ]]; then
			echo 'Cleanup-complete prefetch did not release the client switch receipt' >&2
			exit 1
		fi
		identity_avatar_switch_action="$(
			node "$identity_avatar_release_tool" client-switch-guard \
				--revision "$APP_REVISION" \
				--repository-root "$client_root"
		)"
		if [[ "$identity_avatar_switch_action" != 'released' ]]; then
			echo 'Client switch receipt was not released by cleanup-complete proof' >&2
			exit 1
		fi
		;;
	*)
		echo 'Unknown identity avatar client switch guard state' >&2
		exit 1
		;;
esac

if [[ "$identity_avatar_switch_action" == 'retarget-staged' ]]; then
	if ! systemctl stop \
		winwidget-identity-avatar-client-log-soak.timer \
		winwidget-identity-avatar-client-log-soak.service; then
		echo 'Existing frontend avatar soak scheduler could not be fenced' >&2
		exit 1
	fi
	if systemctl is-active --quiet \
		winwidget-identity-avatar-client-log-soak.timer ||
		systemctl is-active --quiet \
			winwidget-identity-avatar-client-log-soak.service; then
		echo 'Existing frontend avatar soak scheduler remained active' >&2
		exit 1
	fi
fi

if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	pre_rebind_container_id="$(compose ps -q client)"
	if [[ -z "$pre_rebind_container_id" ]]; then
		echo 'Frontend runtime rebind requires the live client container' >&2
		exit 1
	fi
	read -r \
		identity_avatar_runtime_rebind_fresh_generation \
		identity_avatar_runtime_rebind_fresh_mode \
		identity_avatar_runtime_rebind_fresh_image \
		identity_avatar_runtime_rebind_fresh_previous_process \
		identity_avatar_runtime_rebind_fresh_ready_sha \
		identity_avatar_runtime_rebind_fresh_prepared_observed_process \
		identity_avatar_runtime_rebind_fresh_process \
		identity_avatar_runtime_rebind_fresh_local_state \
		identity_avatar_runtime_rebind_fresh_mutation_sha \
		identity_avatar_runtime_rebind_fresh_mutation_signature_sha <<<"$(
		node "$identity_avatar_runtime_rebind_tool" archive-ready-live \
			--revision "$APP_REVISION"
	)"
	boundary_container_id="$(compose ps -q client)"
	if [[ "$boundary_container_id" != "$pre_rebind_container_id" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_generation" != \
			"$identity_avatar_runtime_rebind_generation" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_mode" != \
			"$identity_avatar_runtime_rebind_mode" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_image" != \
			"$identity_avatar_runtime_rebind_expected_image" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_previous_process" != \
			"$identity_avatar_runtime_rebind_previous_process" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_ready_sha" != \
			"$identity_avatar_runtime_rebind_ready_sha" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_prepared_observed_process" != \
			"$identity_avatar_runtime_rebind_prepared_observed_process" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_local_state" != \
			"$identity_avatar_runtime_rebind_local_state" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_mutation_sha" != \
			"$identity_avatar_runtime_rebind_mutation_sha" ]] ||
		[[ "$identity_avatar_runtime_rebind_fresh_mutation_signature_sha" != \
			"$identity_avatar_runtime_rebind_mutation_signature_sha" ]] ||
		[[ ! "$identity_avatar_runtime_rebind_fresh_process" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
		echo 'Frontend runtime rebind apply boundary changed before mutation' >&2
		exit 1
	fi
	boundary_container_image="$(
		docker inspect "$boundary_container_id" --format '{{ .Image }}'
	)"
	boundary_container_generation="$(
		docker inspect "$boundary_container_id" \
			--format '{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}'
	)"
	boundary_container_restart_count="$(
		docker inspect "$boundary_container_id" --format '{{ .RestartCount }}'
	)"
	if [[ "$boundary_container_image" != \
		"$identity_avatar_runtime_rebind_expected_image" ]] ||
		[[ ! "$boundary_container_generation" =~ ^(0|[1-9][0-9]?)$ ]] ||
		((10#$boundary_container_generation > 64)) ||
		[[ ! "$boundary_container_restart_count" =~ ^(0|[1-9][0-9]*)$ ]]; then
		echo 'Frontend runtime rebind cannot use a missing or changed image' >&2
		exit 1
	fi
	identity_avatar_runtime_rebind_boundary_action="$(
		node "$identity_avatar_runtime_rebind_tool" classify-apply-boundary \
			--revision "$APP_REVISION" \
			--generation "$identity_avatar_runtime_rebind_generation" \
			--live-process-started-at "$identity_avatar_runtime_rebind_fresh_process" \
			--live-container-generation "$boundary_container_generation" \
			--live-container-restart-count "$boundary_container_restart_count"
	)"
	case "$identity_avatar_runtime_rebind_boundary_action" in
	planned-mutation-required)
		read -r \
			identity_avatar_runtime_rebind_published_mutation_sha \
			identity_avatar_runtime_rebind_published_mutation_signature_sha \
			identity_avatar_runtime_rebind_post_mutation_ready_sha <<<"$(
			node "$identity_avatar_runtime_rebind_tool" publish-mutation-start-live \
				--revision "$APP_REVISION" \
				--generation "$identity_avatar_runtime_rebind_generation" \
				--live-image-id "$boundary_container_image" \
				--live-process-started-at "$identity_avatar_runtime_rebind_fresh_process"
		)"
		if [[ ! "$identity_avatar_runtime_rebind_published_mutation_sha" =~ ^[0-9a-f]{64}$ ]] ||
			[[ ! "$identity_avatar_runtime_rebind_published_mutation_signature_sha" =~ ^[0-9a-f]{64}$ ]] ||
			[[ "$identity_avatar_runtime_rebind_post_mutation_ready_sha" != \
				"$identity_avatar_runtime_rebind_ready_sha" ]]; then
			echo 'Frontend mutation-start publication or READY refetch is invalid' >&2
			exit 1
		fi
		read -r \
			identity_avatar_runtime_rebind_mutation_generation \
			identity_avatar_runtime_rebind_mutation_mode \
			identity_avatar_runtime_rebind_mutation_image \
			identity_avatar_runtime_rebind_mutation_previous_process \
			identity_avatar_runtime_rebind_mutation_ready_sha \
			identity_avatar_runtime_rebind_mutation_prepared_observed_process \
			identity_avatar_runtime_rebind_mutation_process \
			identity_avatar_runtime_rebind_mutation_local_state \
			identity_avatar_runtime_rebind_mutation_body_sha \
			identity_avatar_runtime_rebind_mutation_signature_sha <<<"$(
			node "$identity_avatar_runtime_rebind_tool" archive-ready-live \
				--revision "$APP_REVISION"
		)"
		mutation_boundary_container_id="$(compose ps -q client)"
		mutation_boundary_container_image="$(
			docker inspect "$mutation_boundary_container_id" --format '{{ .Image }}'
		)"
		mutation_boundary_container_generation="$(
			docker inspect "$mutation_boundary_container_id" \
				--format '{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}'
		)"
		mutation_boundary_container_restart_count="$(
			docker inspect "$mutation_boundary_container_id" --format '{{ .RestartCount }}'
		)"
		if [[ "$mutation_boundary_container_id" != "$boundary_container_id" ]] ||
			[[ "$mutation_boundary_container_image" != "$boundary_container_image" ]] ||
			[[ "$mutation_boundary_container_generation" != "$boundary_container_generation" ]] ||
			[[ "$mutation_boundary_container_restart_count" != "$boundary_container_restart_count" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_generation" != "$identity_avatar_runtime_rebind_generation" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_mode" != "$identity_avatar_runtime_rebind_mode" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_image" != "$identity_avatar_runtime_rebind_expected_image" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_previous_process" != "$identity_avatar_runtime_rebind_previous_process" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_ready_sha" != "$identity_avatar_runtime_rebind_ready_sha" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_prepared_observed_process" != "$identity_avatar_runtime_rebind_prepared_observed_process" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_process" != "$identity_avatar_runtime_rebind_fresh_process" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_local_state" != "$identity_avatar_runtime_rebind_local_state" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_body_sha" != "$identity_avatar_runtime_rebind_published_mutation_sha" ]] ||
			[[ "$identity_avatar_runtime_rebind_mutation_signature_sha" != "$identity_avatar_runtime_rebind_published_mutation_signature_sha" ]]; then
			echo 'Frontend runtime changed after mutation-start publication' >&2
			exit 1
		fi
		identity_avatar_runtime_rebind_mutation_boundary_action="$(
			node "$identity_avatar_runtime_rebind_tool" classify-apply-boundary \
				--revision "$APP_REVISION" \
				--generation "$identity_avatar_runtime_rebind_generation" \
				--live-process-started-at "$identity_avatar_runtime_rebind_mutation_process" \
				--live-container-generation "$mutation_boundary_container_generation" \
				--live-container-restart-count "$mutation_boundary_container_restart_count"
		)"
		if [[ "$identity_avatar_runtime_rebind_mutation_boundary_action" != \
			'planned-mutation-required' ]]; then
			echo 'Frontend mutation-start did not preserve the planned boundary' >&2
			exit 1
		fi
		compose up -d --no-build --force-recreate client
		;;
	planned-mutation-complete | recovery-adoption)
		identity_avatar_runtime_rebind_expected_process="$identity_avatar_runtime_rebind_fresh_process"
		;;
	*)
		echo 'Frontend runtime rebind apply boundary classification is invalid' >&2
		exit 1
		;;
	esac
else
	compose up -d --no-build client
fi

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
container_image_id="$(docker inspect "$container_id" --format '{{ .Image }}')"
if [[ "$container_image_id" != "$identity_avatar_image_id" ]]; then
	echo 'Frontend live container does not use the immutable adopted image' >&2
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
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	identity_avatar_runtime_rebind_live_generation="$(
		docker inspect "$container_id" \
			--format '{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}'
	)"
	identity_avatar_runtime_rebind_live_restart_count="$(
		docker inspect "$container_id" --format '{{ .RestartCount }}'
	)"
	if [[ ! "$identity_avatar_runtime_rebind_live_generation" =~ ^(0|[1-9][0-9]?)$ ]] ||
		((10#$identity_avatar_runtime_rebind_live_generation > 64)) ||
		[[ ! "$identity_avatar_runtime_rebind_live_restart_count" =~ ^(0|[1-9][0-9]*)$ ]]; then
		echo 'Frontend runtime rebind live container metadata is invalid' >&2
		exit 1
	fi
	if [[ "$identity_avatar_runtime_rebind_mode" == 'planned-restart' ]]; then
		if [[ "$identity_avatar_runtime_rebind_live_generation" != \
			"$identity_avatar_runtime_rebind_generation" ]] ||
			[[ "$identity_avatar_runtime_rebind_live_restart_count" != '0' ]]; then
			echo 'Planned runtime rebind live container generation drifted' >&2
			exit 1
		fi
	elif ((10#$identity_avatar_runtime_rebind_live_generation >=
		10#$identity_avatar_runtime_rebind_generation)); then
		echo 'Recovery-adoption must retain an earlier container generation label' >&2
		exit 1
	fi
fi

served_revision="$(
	curl -fsSI "$HEALTHCHECK_URL" | awk -F ': ' '
		tolower($1) == "x-winwidget-revision" {
			value = $2
			sub(/\r$/, "", value)
			print value
			exit
		}
	'
)"
if [[ "$served_revision" != "$APP_REVISION" ]]; then
	echo 'Frontend HTTP revision header mismatch' >&2
	exit 1
fi

identity_avatar_fetch_public_evidence() {
	local url="$1"
	local body_path="$2"
	local headers_path="$3"
	local expected_content_type="$4"
	local http_status
	local response_revision
	local cache_control
	local content_type

	http_status="$(
		curl --proto '=https' --tlsv1.2 \
			--connect-timeout 10 --max-time 30 \
			-sS -D "$headers_path" -o "$body_path" \
			-w '%{http_code}' "$url"
	)"
	if [[ "$http_status" != '200' ]]; then
		echo "Public identity avatar client evidence returned HTTP $http_status" >&2
		exit 1
	fi
	if awk -F ': *' 'tolower($1) == "location" { found = 1 } END { exit(found ? 0 : 1) }' \
		"$headers_path"; then
		echo 'Public identity avatar client evidence must not redirect' >&2
		exit 1
	fi
	response_revision="$(
		awk -F ': *' '
			tolower($1) == "x-winwidget-revision" {
				value = $2
				sub(/\r$/, "", value)
				print value
				exit
			}
		' "$headers_path"
	)"
	cache_control="$(
		awk -F ': *' '
			tolower($1) == "cache-control" {
				value = $2
				sub(/\r$/, "", value)
				print value
				exit
			}
		' "$headers_path"
	)"
	content_type="$(
		awk -F ': *' '
			tolower($1) == "content-type" {
				value = $2
				sub(/\r$/, "", value)
				print value
				exit
			}
		' "$headers_path"
	)"
	if [[ "$response_revision" != "$APP_REVISION" ]] ||
		[[ "$cache_control" != 'no-store, max-age=0' ]] ||
		[[ "$content_type" != "$expected_content_type" ]]; then
		echo 'Public identity avatar client evidence headers do not match the release contract' >&2
		exit 1
	fi
}

identity_avatar_release_url="$identity_avatar_public_base/$APP_REVISION/release-evidence-v1.json"
identity_avatar_signature_url="${identity_avatar_release_url}.sig"
identity_avatar_runtime_url="$identity_avatar_public_base/runtime-v1.json"
identity_avatar_public_manifest="$identity_avatar_work_dir/public-release-evidence-v1.json"
identity_avatar_public_signature="$identity_avatar_work_dir/public-release-evidence-v1.json.sig"
identity_avatar_runtime_first="$identity_avatar_work_dir/runtime-first-v1.json"
identity_avatar_runtime_second="$identity_avatar_work_dir/runtime-second-v1.json"

identity_avatar_fetch_public_evidence \
	"$identity_avatar_release_url" \
	"$identity_avatar_public_manifest" \
	"$identity_avatar_work_dir/public-release.headers" \
	'application/json; charset=utf-8'
identity_avatar_fetch_public_evidence \
	"$identity_avatar_signature_url" \
	"$identity_avatar_public_signature" \
	"$identity_avatar_work_dir/public-signature.headers" \
	'application/octet-stream'
identity_avatar_fetch_public_evidence \
	"$identity_avatar_runtime_url" \
	"$identity_avatar_runtime_first" \
	"$identity_avatar_work_dir/runtime-first.headers" \
	'application/json; charset=utf-8'
identity_avatar_fetch_public_evidence \
	"$identity_avatar_runtime_url" \
	"$identity_avatar_runtime_second" \
	"$identity_avatar_work_dir/runtime-second.headers" \
	'application/json; charset=utf-8'

if [[ "$(sha256sum "$identity_avatar_public_manifest" | awk '{ print $1 }')" != \
	"$identity_avatar_release_sha" ]] ||
	[[ "$(sha256sum "$identity_avatar_public_signature" | awk '{ print $1 }')" != \
		"$identity_avatar_signature_sha" ]]; then
	echo 'Public identity avatar client evidence bytes differ from the signed host artifacts' >&2
	exit 1
fi
node "$identity_avatar_release_tool" verify-release \
	--manifest "$identity_avatar_public_manifest" \
	--signature "$identity_avatar_public_signature" \
	--public-key "$identity_avatar_signing_public" \
	--revision "$APP_REVISION"
node "$identity_avatar_release_tool" verify-runtime \
	--runtime "$identity_avatar_runtime_first" \
	--manifest "$identity_avatar_public_manifest" \
	--signature "$identity_avatar_public_signature" \
	--revision "$APP_REVISION"
node "$identity_avatar_release_tool" verify-runtime \
	--runtime "$identity_avatar_runtime_second" \
	--previous-runtime "$identity_avatar_runtime_first" \
	--manifest "$identity_avatar_public_manifest" \
	--signature "$identity_avatar_public_signature" \
	--revision "$APP_REVISION"

container_started_at="$(docker inspect "$container_id" --format '{{ .State.StartedAt }}')"
identity_avatar_process_started_at_file="$identity_avatar_work_dir/process-started-at.txt"
IDENTITY_AVATAR_RUNTIME_FILE="$identity_avatar_runtime_second" \
	IDENTITY_AVATAR_CONTAINER_STARTED_AT="$container_started_at" \
	IDENTITY_AVATAR_PROCESS_STARTED_AT_FILE="$identity_avatar_process_started_at_file" node <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');
const runtime = JSON.parse(
  readFileSync(process.env.IDENTITY_AVATAR_RUNTIME_FILE, 'utf8'),
);
const processStartedAt = Date.parse(runtime.processStartedAt);
const containerStartedAt = Date.parse(
  process.env.IDENTITY_AVATAR_CONTAINER_STARTED_AT,
);
const now = Date.now();
if (
  !Number.isFinite(processStartedAt) ||
  !Number.isFinite(containerStartedAt) ||
  processStartedAt < containerStartedAt - 5000 ||
  processStartedAt > now + 5000
) {
  throw new Error('Frontend processStartedAt is outside the live container boundary');
}
writeFileSync(
  process.env.IDENTITY_AVATAR_PROCESS_STARTED_AT_FILE,
  runtime.processStartedAt,
  { encoding: 'utf8', mode: 0o600 },
);
NODE

identity_avatar_process_started_at="$(<"$identity_avatar_process_started_at_file")"
if [[ ! "$identity_avatar_process_started_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
	echo 'Frontend processStartedAt could not be pinned for log soak' >&2
	exit 1
fi
identity_avatar_soak_generation_args=''
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	identity_avatar_runtime_rebind_process_container_id="$(compose ps -q client)"
	if [[ "$identity_avatar_runtime_rebind_process_container_id" != "$container_id" ]]; then
		echo 'Frontend container changed while pinning the runtime rebind process' >&2
		exit 1
	fi
	identity_avatar_runtime_rebind_process_generation="$(
		docker inspect "$container_id" \
			--format '{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}'
	)"
	identity_avatar_runtime_rebind_process_restart_count="$(
		docker inspect "$container_id" --format '{{ .RestartCount }}'
	)"
	if [[ ! "$identity_avatar_runtime_rebind_process_generation" =~ ^(0|[1-9][0-9]?)$ ]] ||
		((10#$identity_avatar_runtime_rebind_process_generation > 64)) ||
		[[ ! "$identity_avatar_runtime_rebind_process_restart_count" =~ ^(0|[1-9][0-9]*)$ ]]; then
		echo 'Frontend runtime rebind process container metadata is invalid' >&2
		exit 1
	fi
	identity_avatar_runtime_rebind_process_action="$(
		node "$identity_avatar_runtime_rebind_tool" classify-apply-boundary \
			--revision "$APP_REVISION" \
			--generation "$identity_avatar_runtime_rebind_generation" \
			--live-process-started-at "$identity_avatar_process_started_at" \
			--live-container-generation "$identity_avatar_runtime_rebind_process_generation" \
			--live-container-restart-count "$identity_avatar_runtime_rebind_process_restart_count"
	)"
	if [[ "$identity_avatar_runtime_rebind_mode" == 'planned-restart' ]] &&
		[[ "$identity_avatar_runtime_rebind_process_action" != \
			'planned-mutation-complete' ]]; then
		echo 'Planned runtime rebind process did not bind the target generation' >&2
		exit 1
	fi
	if [[ "$identity_avatar_runtime_rebind_mode" == 'recovery-adoption' ]] &&
		[[ "$identity_avatar_runtime_rebind_process_action" != 'recovery-adoption' ]]; then
		echo 'Recovery-adoption process changed after PREPARED' >&2
		exit 1
	fi
	if [[ -n "$identity_avatar_runtime_rebind_expected_process" ]] &&
		[[ "$identity_avatar_process_started_at" != \
			"$identity_avatar_runtime_rebind_expected_process" ]]; then
		echo 'Frontend runtime rebind process drifted after the fresh apply boundary' >&2
		exit 1
	fi
	identity_avatar_runtime_rebind_expected_process="$identity_avatar_process_started_at"
	identity_avatar_runtime_rebind_expected_container_generation="$identity_avatar_runtime_rebind_process_generation"
	identity_avatar_soak_generation_args=" --generation $identity_avatar_runtime_rebind_generation --initial-anchor-sha $identity_avatar_runtime_rebind_ready_sha"
fi

read -r \
	identity_avatar_image_proof_sha \
	identity_avatar_image_proof_signature_sha <<<"$(
	node "$identity_avatar_runtime_rebind_tool" create-image-adoption \
		--revision "$APP_REVISION" \
		--image-adoption "$identity_avatar_image_adoption" \
		--live-image-id "$container_image_id" \
		--release "$identity_avatar_release_directory/release-evidence-v1.json" \
		--release-signature "$identity_avatar_release_directory/release-evidence-v1.json.sig" \
		--repository-root "$client_root"
)"
if [[ ! "$identity_avatar_image_proof_sha" =~ ^[0-9a-f]{64}$ ]] ||
	[[ ! "$identity_avatar_image_proof_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
	echo 'Signed frontend image-adoption proof hashes are invalid' >&2
	exit 1
fi
identity_avatar_image_proof_url="$identity_avatar_public_base/$APP_REVISION/image-adoption-v1.json"
identity_avatar_public_image_proof_first="$identity_avatar_work_dir/public-image-adoption-first.json"
identity_avatar_public_image_proof_second="$identity_avatar_work_dir/public-image-adoption-second.json"
identity_avatar_public_image_proof_signature="$identity_avatar_work_dir/public-image-adoption.json.sig"
identity_avatar_fetch_public_evidence \
	"$identity_avatar_image_proof_url" \
	"$identity_avatar_public_image_proof_first" \
	"$identity_avatar_work_dir/public-image-adoption-first.headers" \
	'application/json; charset=utf-8'
identity_avatar_fetch_public_evidence \
	"${identity_avatar_image_proof_url}.sig" \
	"$identity_avatar_public_image_proof_signature" \
	"$identity_avatar_work_dir/public-image-adoption-signature.headers" \
	'application/octet-stream'
identity_avatar_fetch_public_evidence \
	"$identity_avatar_image_proof_url" \
	"$identity_avatar_public_image_proof_second" \
	"$identity_avatar_work_dir/public-image-adoption-second.headers" \
	'application/json; charset=utf-8'
if ! cmp -s \
	"$identity_avatar_public_image_proof_first" \
	"$identity_avatar_public_image_proof_second" ||
	[[ "$(sha256sum "$identity_avatar_public_image_proof_first" | awk '{ print $1 }')" != \
		"$identity_avatar_image_proof_sha" ]] ||
	[[ "$(sha256sum "$identity_avatar_public_image_proof_signature" | awk '{ print $1 }')" != \
		"$identity_avatar_image_proof_signature_sha" ]]; then
	echo 'Public signed frontend image-adoption proof is unstable or unbound' >&2
	exit 1
fi
verified_image_id="$(
	node "$identity_avatar_runtime_rebind_tool" verify-image-adoption \
		--body "$identity_avatar_public_image_proof_first" \
		--signature "$identity_avatar_public_image_proof_signature" \
		--public-key "$identity_avatar_signing_public" \
		--revision "$APP_REVISION"
)"
if [[ "$verified_image_id" != "$container_image_id" ]]; then
	echo 'Public signed image-adoption proof does not bind the live image' >&2
	exit 1
fi

if [[ "$identity_avatar_switch_action" == 'initial' ]]; then
	node "$identity_avatar_release_tool" create-client-switch-receipt \
		--revision "$APP_REVISION" \
		--release-sha "$identity_avatar_release_sha" \
		--backend-revision "$identity_avatar_backend_server_revision" \
		--client-ready-sha "$identity_avatar_backend_client_ready_sha" \
		--client-ready-signature-sha "$identity_avatar_backend_client_ready_signature_sha" \
		--process-started-at "$identity_avatar_process_started_at" \
		--client-ready "$identity_avatar_backend_client_ready_file" \
		--client-ready-signature "$identity_avatar_backend_client_ready_signature_file"
fi

identity_avatar_node_binary="$(command -v node)"
identity_avatar_flock_binary="$(command -v flock)"
if [[ ! "$identity_avatar_node_binary" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
	[[ ! "$identity_avatar_flock_binary" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
	[[ ! -x "$identity_avatar_node_binary" ]] ||
	[[ ! -x "$identity_avatar_flock_binary" ]]; then
	echo 'Pinned Node.js or flock binary is unavailable for frontend log soak' >&2
	exit 1
fi

identity_avatar_service_source="$identity_avatar_work_dir/winwidget-identity-avatar-client-log-soak.service"
identity_avatar_timer_source="$identity_avatar_work_dir/winwidget-identity-avatar-client-log-soak.timer"
{
	printf '%s\n' \
		'[Unit]' \
		'Description=WinWidget identity avatar client signed log soak heartbeat' \
		'After=network-online.target nginx.service docker.service' \
		'Wants=network-online.target' \
		'StartLimitIntervalSec=10m' \
		'StartLimitBurst=5' \
		'' \
		'[Service]' \
		'Type=oneshot' \
		'User=root' \
		'Group=root' \
		'UMask=0077' \
		'Environment=IDENTITY_AVATAR_SOAK_LOCK_HELD=1' \
		"WorkingDirectory=$client_root" \
		"ExecStart=$identity_avatar_flock_binary --nonblock $identity_avatar_soak_lock $identity_avatar_node_binary $identity_avatar_log_soak_tool heartbeat --revision $APP_REVISION --release-sha $identity_avatar_release_sha --process-started-at $identity_avatar_process_started_at$identity_avatar_soak_generation_args" \
		'Restart=on-failure' \
		'RestartSec=1m' \
		'NoNewPrivileges=true' \
		'PrivateTmp=true' \
		'ProtectHome=true' \
		'ProtectSystem=strict' \
		"ReadWritePaths=$identity_avatar_release_root" \
		'ReadOnlyPaths=/var/log/nginx /etc/nginx/conf.d/winwidget-identity-avatar-client-log-soak.conf /etc/logrotate.d/winwidget-identity-avatar-client-log-soak'
} > "$identity_avatar_service_source"
{
	printf '%s\n' \
		'[Unit]' \
		'Description=Daily WinWidget identity avatar client signed log soak heartbeat' \
		'' \
		'[Timer]' \
		'OnCalendar=*-*-* 03:00:00 UTC' \
		'RandomizedDelaySec=5m' \
		'AccuracySec=1s' \
		'Persistent=true' \
		'Unit=winwidget-identity-avatar-client-log-soak.service' \
		'' \
		'[Install]' \
		'WantedBy=timers.target'
} > "$identity_avatar_timer_source"

identity_avatar_install_managed_config \
	"$identity_avatar_service_source" \
	"$identity_avatar_soak_service"
identity_avatar_service_backup="$identity_avatar_managed_backup"
identity_avatar_install_managed_config \
	"$identity_avatar_timer_source" \
	"$identity_avatar_soak_timer"
identity_avatar_timer_backup="$identity_avatar_managed_backup"
if ! systemd-analyze verify \
	"$identity_avatar_soak_service" \
	"$identity_avatar_soak_timer" >/dev/null 2>&1; then
	identity_avatar_restore_managed_config \
		"$identity_avatar_soak_timer" \
		"$identity_avatar_timer_backup"
	identity_avatar_restore_managed_config \
		"$identity_avatar_soak_service" \
		"$identity_avatar_service_backup"
	systemctl daemon-reload
	echo 'Identity avatar client log-soak systemd units are invalid' >&2
	exit 1
fi
if ! systemctl daemon-reload; then
	identity_avatar_restore_managed_config \
		"$identity_avatar_soak_timer" \
		"$identity_avatar_timer_backup"
	identity_avatar_restore_managed_config \
		"$identity_avatar_soak_service" \
		"$identity_avatar_service_backup"
	systemctl daemon-reload
	echo 'Identity avatar client log-soak systemd reload failed' >&2
	exit 1
fi
if [[ -n "$identity_avatar_service_backup" ]]; then
	rm -f -- "$identity_avatar_service_backup"
fi
if [[ -n "$identity_avatar_timer_backup" ]]; then
	rm -f -- "$identity_avatar_timer_backup"
fi

IDENTITY_AVATAR_SOAK_LOCK_PATH="$identity_avatar_soak_lock" \
	"$identity_avatar_node_binary" <<'NODE'
const { constants, closeSync, fsyncSync, openSync } = require('node:fs');
if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
  throw new Error('Identity avatar log soak lock creation requires root');
}
let descriptor;
try {
  descriptor = openSync(
    process.env.IDENTITY_AVATAR_SOAK_LOCK_PATH,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_RDWR |
      constants.O_NOFOLLOW,
    0o600,
  );
  fsyncSync(descriptor);
} catch (error) {
  if (!error || error.code !== 'EEXIST') throw error;
} finally {
  if (descriptor !== undefined) closeSync(descriptor);
}
NODE
if [[ ! -f "$identity_avatar_soak_lock" || -L "$identity_avatar_soak_lock" ]] ||
	[[ "$(stat -c '%u:%g:%a:%h' "$identity_avatar_soak_lock")" != '0:0:600:1' ]]; then
	echo 'Identity avatar client log soak lock is not a secure root-owned file' >&2
	exit 1
fi
exec {identity_avatar_soak_lock_fd}<>"$identity_avatar_soak_lock"
if ! "$identity_avatar_flock_binary" --exclusive --nonblock "$identity_avatar_soak_lock_fd"; then
	echo 'Identity avatar client log soak producer is already running' >&2
	exit 1
fi
identity_avatar_soak_cli_args=()
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	identity_avatar_soak_cli_args+=(
		--generation "$identity_avatar_runtime_rebind_generation"
		--initial-anchor-sha "$identity_avatar_runtime_rebind_ready_sha"
	)
fi
read -r \
	identity_avatar_before_soak_sequence \
	identity_avatar_before_soak_sha \
	identity_avatar_before_soak_generated_at <<<"$(
	node "$identity_avatar_log_soak_tool" checkpoint \
		--revision "$APP_REVISION" \
		--release-sha "$identity_avatar_release_sha" \
		--process-started-at "$identity_avatar_process_started_at" \
		"${identity_avatar_soak_cli_args[@]}"
)"
if [[ ! "$identity_avatar_before_soak_sequence" =~ ^(0|[1-9][0-9]?)$ ]] ||
	((identity_avatar_before_soak_sequence > 64)) ||
	[[ ! "$identity_avatar_before_soak_sha" =~ ^[0-9a-f]{64}$ ]] ||
	[[ -z "$identity_avatar_before_soak_generated_at" ]]; then
	echo 'Identity avatar client pre-invocation heartbeat checkpoint is invalid' >&2
	exit 1
fi
if [[ "$identity_avatar_switch_action" == 'retarget-staged' ]] &&
	((identity_avatar_before_soak_sequence > 1)); then
	echo 'A staged client retarget must not advance beyond its first heartbeat' >&2
	exit 1
fi
if [[ "$identity_avatar_runtime_rebind_local_state" == 'adopted' ]] &&
	((identity_avatar_before_soak_sequence < 1)); then
	echo 'Terminal runtime rebind recovery lacks its immutable first heartbeat' >&2
	exit 1
fi
if [[ "$identity_avatar_runtime_rebind_local_state" != 'adopted' ]] && {
	[[ "$identity_avatar_switch_action" != 'retarget-staged' ]] ||
		((identity_avatar_before_soak_sequence == 0));
}; then
	if ((identity_avatar_before_soak_sequence >= 64)); then
		echo 'Identity avatar client log soak reached its signed sequence bound' >&2
		exit 1
	fi
	identity_avatar_required_soak_sequence="$((identity_avatar_before_soak_sequence + 1))"
	identity_avatar_soak_invoked_after="$(
		node -e 'process.stdout.write(new Date().toISOString())'
	)"
	if ! IDENTITY_AVATAR_SOAK_LOCK_HELD=1 \
		"$identity_avatar_node_binary" "$identity_avatar_log_soak_tool" heartbeat \
		--revision "$APP_REVISION" \
			--release-sha "$identity_avatar_release_sha" \
			--process-started-at "$identity_avatar_process_started_at" \
			--minimum-sequence "$identity_avatar_required_soak_sequence" \
			"${identity_avatar_soak_cli_args[@]}"; then
		echo 'Identity avatar client first signed log soak heartbeat failed' >&2
		exit 1
	fi
	node "$identity_avatar_log_soak_tool" verify-fresh-heartbeat \
		--revision "$APP_REVISION" \
		--release-sha "$identity_avatar_release_sha" \
		--process-started-at "$identity_avatar_process_started_at" \
		--before-sequence "$identity_avatar_before_soak_sequence" \
		--before-body-sha "$identity_avatar_before_soak_sha" \
		--invoked-after "$identity_avatar_soak_invoked_after" \
		"${identity_avatar_soak_cli_args[@]}" >/dev/null
fi
"$identity_avatar_flock_binary" --unlock "$identity_avatar_soak_lock_fd"
exec {identity_avatar_soak_lock_fd}>&-

identity_avatar_retarget_body_sha=''
identity_avatar_retarget_signature_sha=''
if [[ "$identity_avatar_switch_action" == 'retarget-staged' ]]; then
	identity_avatar_retarget_heartbeat="$identity_avatar_release_directory/soak/heartbeat-000001-v1.json"
	identity_avatar_retarget_heartbeat_signature="${identity_avatar_retarget_heartbeat}.sig"
	identity_avatar_retarget_health_first="$identity_avatar_work_dir/retarget-backend-health-first.json"
	identity_avatar_fetch_backend_health \
		"$identity_avatar_retarget_health_first" \
		"$identity_avatar_work_dir/retarget-backend-health-first.headers"
	identity_avatar_retarget_backend_revision="$(
		node "$identity_avatar_release_tool" read-backend-deployment-revision \
			--health "$identity_avatar_retarget_health_first"
	)"
	node "$identity_avatar_retarget_tool" prepare-outcome \
		--repository-root "$client_root" \
		--revision "$APP_REVISION" \
		--backend-runtime-revision "$identity_avatar_retarget_backend_revision" \
		--release "$identity_avatar_release_directory/release-evidence-v1.json" \
		--release-signature "$identity_avatar_release_directory/release-evidence-v1.json.sig" \
		--runtime "$identity_avatar_runtime_second" \
		--heartbeat "$identity_avatar_retarget_heartbeat" \
		--heartbeat-signature "$identity_avatar_retarget_heartbeat_signature" >/dev/null
fi

if [[ "$identity_avatar_switch_action" == 'retarget-staged' ||
	"$identity_avatar_switch_action" == 'retarget-applied' ]]; then
	identity_avatar_retarget_local_body="$identity_avatar_release_directory/soak-retarget-v1.json"
	identity_avatar_retarget_local_signature="${identity_avatar_retarget_local_body}.sig"
	identity_avatar_retarget_public_url="$identity_avatar_public_base/$APP_REVISION/soak-retarget-v1.json"
	identity_avatar_retarget_public_body_first="$identity_avatar_work_dir/public-soak-retarget-first.json"
	identity_avatar_retarget_public_body_second="$identity_avatar_work_dir/public-soak-retarget-second.json"
	identity_avatar_retarget_public_signature="$identity_avatar_work_dir/public-soak-retarget.json.sig"
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_retarget_public_url" \
		"$identity_avatar_retarget_public_body_first" \
		"$identity_avatar_work_dir/public-soak-retarget-first.headers" \
		'application/json; charset=utf-8'
	identity_avatar_fetch_public_evidence \
		"${identity_avatar_retarget_public_url}.sig" \
		"$identity_avatar_retarget_public_signature" \
		"$identity_avatar_work_dir/public-soak-retarget-signature.headers" \
		'application/octet-stream'
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_retarget_public_url" \
		"$identity_avatar_retarget_public_body_second" \
		"$identity_avatar_work_dir/public-soak-retarget-second.headers" \
		'application/json; charset=utf-8'
	cmp -s \
		"$identity_avatar_retarget_public_body_first" \
		"$identity_avatar_retarget_public_body_second" || {
		echo 'Public client retarget body changed during stable-pair fetch' >&2
		exit 1
	}
	cmp -s \
		"$identity_avatar_retarget_local_body" \
		"$identity_avatar_retarget_public_body_first" || {
		echo 'Public client retarget body differs from durable local evidence' >&2
		exit 1
	}
	cmp -s \
		"$identity_avatar_retarget_local_signature" \
		"$identity_avatar_retarget_public_signature" || {
		echo 'Public client retarget signature differs from durable local evidence' >&2
		exit 1
	}
	node "$identity_avatar_retarget_tool" verify-outcome \
		--revision "$APP_REVISION" \
		--body "$identity_avatar_retarget_public_body_first" \
		--signature "$identity_avatar_retarget_public_signature" \
		--public-key "$identity_avatar_signing_public"
	if [[ "$identity_avatar_switch_action" == 'retarget-staged' ]]; then
		identity_avatar_retarget_health_second="$identity_avatar_work_dir/retarget-backend-health-second.json"
		identity_avatar_fetch_backend_health \
			"$identity_avatar_retarget_health_second" \
			"$identity_avatar_work_dir/retarget-backend-health-second.headers"
		identity_avatar_retarget_backend_revision_second="$(
			node "$identity_avatar_release_tool" read-backend-deployment-revision \
				--health "$identity_avatar_retarget_health_second"
		)"
		if [[ "$identity_avatar_retarget_backend_revision_second" != \
			"$identity_avatar_retarget_backend_revision" ]]; then
			echo 'Backend runtime changed during client retarget publication' >&2
			exit 1
		fi
	fi
	node "$identity_avatar_retarget_tool" commit-outcome \
		--repository-root "$client_root" \
		--revision "$APP_REVISION" \
		--public-body "$identity_avatar_retarget_public_body_first" \
		--public-signature "$identity_avatar_retarget_public_signature" >/dev/null
	identity_avatar_switch_action='retarget-applied'
	identity_avatar_retarget_body_sha="$(
		sha256sum "$identity_avatar_retarget_public_body_first" | awk '{ print $1 }'
	)"
	identity_avatar_retarget_signature_sha="$(
		sha256sum "$identity_avatar_retarget_public_signature" | awk '{ print $1 }'
	)"
	if [[ ! "$identity_avatar_retarget_body_sha" =~ ^[0-9a-f]{64}$ ]] ||
		[[ ! "$identity_avatar_retarget_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
		echo 'Client retarget public evidence hashes are invalid' >&2
		exit 1
	fi
fi

identity_avatar_runtime_rebind_adopted_sha=''
identity_avatar_runtime_rebind_adopted_signature_sha=''
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	read -r \
		identity_avatar_runtime_rebind_adopted_sha \
		identity_avatar_runtime_rebind_adopted_signature_sha <<<"$(
			node "$identity_avatar_runtime_rebind_tool" adopt-live \
				--revision "$APP_REVISION" \
				--generation "$identity_avatar_runtime_rebind_generation" \
				--live-image-id "$container_image_id" \
				--expected-process-started-at "$identity_avatar_process_started_at"
	)"
	if [[ ! "$identity_avatar_runtime_rebind_adopted_sha" =~ ^[0-9a-f]{64}$ ]] ||
		[[ ! "$identity_avatar_runtime_rebind_adopted_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
		echo 'Frontend runtime rebind ADOPTED hashes are invalid' >&2
		exit 1
	fi
	identity_avatar_runtime_rebind_generation_name="generation-$(printf '%06d' "$identity_avatar_runtime_rebind_generation")"
	identity_avatar_runtime_rebind_heartbeat_url="$identity_avatar_public_base/$APP_REVISION/runtime-rebind/$identity_avatar_runtime_rebind_generation_name/heartbeat-000001-v1.json"
	identity_avatar_runtime_rebind_local_root="$identity_avatar_release_directory/runtime-rebind/$identity_avatar_runtime_rebind_generation_name"
	identity_avatar_runtime_rebind_public_heartbeat_first="$identity_avatar_work_dir/runtime-rebind-heartbeat-first.json"
	identity_avatar_runtime_rebind_public_heartbeat_second="$identity_avatar_work_dir/runtime-rebind-heartbeat-second.json"
	identity_avatar_runtime_rebind_public_heartbeat_signature="$identity_avatar_work_dir/runtime-rebind-heartbeat.json.sig"
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_runtime_rebind_heartbeat_url" \
		"$identity_avatar_runtime_rebind_public_heartbeat_first" \
		"$identity_avatar_work_dir/runtime-rebind-heartbeat-first.headers" \
		'application/json; charset=utf-8'
	identity_avatar_fetch_public_evidence \
		"${identity_avatar_runtime_rebind_heartbeat_url}.sig" \
		"$identity_avatar_runtime_rebind_public_heartbeat_signature" \
		"$identity_avatar_work_dir/runtime-rebind-heartbeat-signature.headers" \
		'application/octet-stream'
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_runtime_rebind_heartbeat_url" \
		"$identity_avatar_runtime_rebind_public_heartbeat_second" \
		"$identity_avatar_work_dir/runtime-rebind-heartbeat-second.headers" \
		'application/json; charset=utf-8'
	if ! cmp -s \
		"$identity_avatar_runtime_rebind_public_heartbeat_first" \
		"$identity_avatar_runtime_rebind_public_heartbeat_second" ||
		! cmp -s \
			"$identity_avatar_runtime_rebind_public_heartbeat_first" \
			"$identity_avatar_runtime_rebind_local_root/heartbeat-000001-v1.json" ||
		! cmp -s \
			"$identity_avatar_runtime_rebind_public_heartbeat_signature" \
			"$identity_avatar_runtime_rebind_local_root/heartbeat-000001-v1.json.sig"; then
		echo 'Frontend runtime rebind first heartbeat is not stable and public' >&2
		exit 1
	fi
fi

if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	identity_avatar_terminal_container_id="$(compose ps -q client)"
	if [[ "$identity_avatar_terminal_container_id" != "$container_id" ]]; then
		echo 'Frontend runtime rebind container changed before timer recovery' >&2
		exit 1
	fi
	identity_avatar_terminal_container_first="$(
		docker inspect "$identity_avatar_terminal_container_id" \
			--format '{{ .Image }}|{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}|{{ .RestartCount }}|{{ .State.StartedAt }}'
	)"
	IFS='|' read -r \
		identity_avatar_terminal_image \
		identity_avatar_terminal_generation \
		identity_avatar_terminal_restart_count \
		identity_avatar_terminal_started_at <<<"$identity_avatar_terminal_container_first"
	if [[ "$identity_avatar_terminal_image" != "$container_image_id" ]] ||
		[[ "$identity_avatar_terminal_generation" != \
			"$identity_avatar_runtime_rebind_expected_container_generation" ]] ||
		[[ "$identity_avatar_terminal_restart_count" != '0' ]] ||
		[[ "$identity_avatar_terminal_started_at" != "$container_started_at" ]]; then
		echo 'Frontend runtime rebind terminal container binding changed' >&2
		exit 1
	fi
	identity_avatar_terminal_runtime_first="$identity_avatar_work_dir/runtime-terminal-first-v1.json"
	identity_avatar_terminal_runtime_second="$identity_avatar_work_dir/runtime-terminal-second-v1.json"
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_runtime_url" \
		"$identity_avatar_terminal_runtime_first" \
		"$identity_avatar_work_dir/runtime-terminal-first.headers" \
		'application/json; charset=utf-8'
	identity_avatar_fetch_public_evidence \
		"$identity_avatar_runtime_url" \
		"$identity_avatar_terminal_runtime_second" \
		"$identity_avatar_work_dir/runtime-terminal-second.headers" \
		'application/json; charset=utf-8'
	node "$identity_avatar_release_tool" verify-runtime \
		--runtime "$identity_avatar_terminal_runtime_first" \
		--manifest "$identity_avatar_public_manifest" \
		--signature "$identity_avatar_public_signature" \
		--revision "$APP_REVISION"
	node "$identity_avatar_release_tool" verify-runtime \
		--runtime "$identity_avatar_terminal_runtime_second" \
		--previous-runtime "$identity_avatar_terminal_runtime_first" \
		--manifest "$identity_avatar_public_manifest" \
		--signature "$identity_avatar_public_signature" \
		--revision "$APP_REVISION"
	identity_avatar_terminal_process="$(
		IDENTITY_AVATAR_RUNTIME_FILE="$identity_avatar_terminal_runtime_second" \
			node -e 'const { readFileSync } = require("node:fs"); process.stdout.write(JSON.parse(readFileSync(process.env.IDENTITY_AVATAR_RUNTIME_FILE, "utf8")).processStartedAt)'
	)"
	identity_avatar_terminal_container_id_second="$(compose ps -q client)"
	identity_avatar_terminal_container_second="$(
		docker inspect "$identity_avatar_terminal_container_id_second" \
			--format '{{ .Image }}|{{ index .Config.Labels "ru.winwidget.identity-avatar.runtime-stability-generation" }}|{{ .RestartCount }}|{{ .State.StartedAt }}'
	)"
	if [[ "$identity_avatar_terminal_process" != \
		"$identity_avatar_process_started_at" ]] ||
		[[ "$identity_avatar_terminal_container_id_second" != \
			"$identity_avatar_terminal_container_id" ]] ||
		[[ "$identity_avatar_terminal_container_second" != \
			"$identity_avatar_terminal_container_first" ]]; then
		echo 'Frontend runtime rebind changed at the terminal timer boundary' >&2
		exit 1
	fi
fi

if ! systemctl reset-failed winwidget-identity-avatar-client-log-soak.service; then
	echo 'Identity avatar client signed log soak service state could not be reset' >&2
	exit 1
fi
systemctl enable --now winwidget-identity-avatar-client-log-soak.timer
if ! systemctl is-active --quiet winwidget-identity-avatar-client-log-soak.timer; then
	echo 'Identity avatar client signed log soak timer failed' >&2
	exit 1
fi

compose ps client
read -r \
	identity_avatar_backend_client_ready_sha \
	identity_avatar_backend_client_ready_signature_sha <<<"$(
	node "$identity_avatar_release_tool" read-client-switch-hashes
)"
if [[ ! "$identity_avatar_backend_client_ready_sha" =~ ^[0-9a-f]{64}$ ]] ||
	[[ ! "$identity_avatar_backend_client_ready_signature_sha" =~ ^[0-9a-f]{64}$ ]]; then
	echo 'Client switch receipt does not expose valid backend ready hashes' >&2
	exit 1
fi
echo "Frontend revision verified: $APP_REVISION"
echo "identity_avatar_client_revision=$APP_REVISION"
echo "identity_avatar_client_release_evidence_sha256=$identity_avatar_release_sha"
echo "identity_avatar_client_image_adoption_sha256=$identity_avatar_image_proof_sha"
echo "identity_avatar_client_image_adoption_signature_sha256=$identity_avatar_image_proof_signature_sha"
echo "identity_avatar_backend_client_ready_sha256=$identity_avatar_backend_client_ready_sha"
echo "identity_avatar_backend_client_ready_signature_sha256=$identity_avatar_backend_client_ready_signature_sha"
if [[ "$identity_avatar_switch_action" == 'retarget-applied' ]]; then
	echo "identity_avatar_client_retarget_revision=$APP_REVISION"
	echo "identity_avatar_client_retarget_release_evidence_sha256=$identity_avatar_release_sha"
	echo "identity_avatar_client_retarget_evidence_sha256=$identity_avatar_retarget_body_sha"
	echo "identity_avatar_client_retarget_signature_sha256=$identity_avatar_retarget_signature_sha"
fi
if [[ "$identity_avatar_runtime_rebind_action" == 'apply' ]]; then
	echo "identity_avatar_client_runtime_rebind_generation=$identity_avatar_runtime_rebind_generation"
	echo "identity_avatar_client_runtime_rebind_adopted_sha256=$identity_avatar_runtime_rebind_adopted_sha"
	echo "identity_avatar_client_runtime_rebind_adopted_signature_sha256=$identity_avatar_runtime_rebind_adopted_signature_sha"
fi
