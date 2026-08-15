#!/usr/bin/env bash

# Durable single-frontend deployment lock. The workflow acquires the same file
# before fetch/checkout and passes descriptor 9 to deploy-production.sh. A
# direct deploy acquires it here. Never unlink or replace the lock inode.

_frontend_production_deploy_lock_fail() {
	echo "$1" >&2
	return 1
}

_frontend_production_deploy_lock_validate_file_for_owner() {
	local lock_file="$1"
	local expected_uid="$2"
	local expected_gid="$3"

	FRONTEND_PRODUCTION_DEPLOY_LOCK_FILE="$lock_file" \
		FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_UID="$expected_uid" \
		FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_GID="$expected_gid" node <<'NODE'
const {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
} = require('node:fs');
const { dirname, resolve } = require('node:path');

const lockFile = process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_FILE;
const expectedUid = Number(
  process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_UID,
);
const expectedGid = Number(
  process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_GID,
);
const parent = dirname(lockFile);

if (
  !lockFile.startsWith('/') ||
  !Number.isSafeInteger(expectedUid) ||
  expectedUid < 0 ||
  !Number.isSafeInteger(expectedGid) ||
  expectedGid < 0
) {
  throw new Error('Frontend production deploy lock inputs are invalid');
}

const parentMetadata = lstatSync(parent);
if (
  realpathSync(parent) !== resolve(parent) ||
  !parentMetadata.isDirectory() ||
  parentMetadata.isSymbolicLink() ||
  parentMetadata.uid !== expectedUid ||
  parentMetadata.gid !== expectedGid ||
  (parentMetadata.mode & 0o022) !== 0
) {
  throw new Error('Frontend production deploy lock directory is not secure');
}

let created = false;
try {
  const descriptor = openSync(
    lockFile,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_RDWR |
      constants.O_NOFOLLOW,
    0o600,
  );
  fsyncSync(descriptor);
  closeSync(descriptor);
  created = true;
} catch (error) {
  if (error?.code !== 'EEXIST') throw error;
}
if (created) {
  const parentDescriptor = openSync(parent, constants.O_RDONLY);
  fsyncSync(parentDescriptor);
  closeSync(parentDescriptor);
}

const metadata = lstatSync(lockFile);
if (
  realpathSync(lockFile) !== resolve(lockFile) ||
  !metadata.isFile() ||
  metadata.isSymbolicLink() ||
  metadata.uid !== expectedUid ||
  metadata.gid !== expectedGid ||
  (metadata.mode & 0o777) !== 0o600 ||
  metadata.nlink !== 1
) {
  throw new Error('Frontend production deploy lock file is not secure');
}
NODE
}

_frontend_production_deploy_lock_validate_descriptor_for_owner() {
	local lock_file="$1"
	local descriptor="$2"
	local expected_uid="$3"
	local expected_gid="$4"

	FRONTEND_PRODUCTION_DEPLOY_LOCK_FILE="$lock_file" \
		FRONTEND_PRODUCTION_DEPLOY_LOCK_FD="$descriptor" \
		FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_UID="$expected_uid" \
		FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_GID="$expected_gid" node <<'NODE'
const { lstatSync, readlinkSync, statSync } = require('node:fs');

const lockFile = process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_FILE;
const descriptor = process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_FD;
const expectedUid = Number(
  process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_UID,
);
const expectedGid = Number(
  process.env.FRONTEND_PRODUCTION_DEPLOY_LOCK_EXPECTED_GID,
);
const descriptorPath = process.platform === 'linux'
  ? `/proc/self/fd/${descriptor}`
  : `/dev/fd/${descriptor}`;
const metadata = lstatSync(lockFile);
const descriptorMetadata = statSync(descriptorPath);
const descriptorTarget = process.platform === 'linux'
  ? readlinkSync(descriptorPath)
  : lockFile;

if (
  descriptorTarget !== lockFile ||
  !metadata.isFile() ||
  metadata.isSymbolicLink() ||
  metadata.uid !== expectedUid ||
  metadata.gid !== expectedGid ||
  (metadata.mode & 0o777) !== 0o600 ||
  metadata.nlink !== 1 ||
  (process.platform === 'linux' && descriptorMetadata.dev !== metadata.dev) ||
  descriptorMetadata.ino !== metadata.ino
) {
  throw new Error('Frontend production deploy lock descriptor is not secure');
}
NODE
}

_frontend_production_deploy_lock_validate_held_for_owner() {
	local operation="$1"
	local lock_file="$2"
	local expected_uid="$3"
	local expected_gid="$4"
	local flock_binary="$5"

	_frontend_production_deploy_lock_validate_descriptor_for_owner \
		"$lock_file" 9 "$expected_uid" "$expected_gid" || return 1
	exec 8<>"$lock_file"
	if "$flock_binary" --exclusive --nonblock 8; then
		"$flock_binary" --unlock 8
		exec 8>&-
		_frontend_production_deploy_lock_fail \
			"Claimed frontend production deploy lock is not held; refusing to start $operation."
		return 1
	fi
	if ! "$flock_binary" --exclusive --nonblock 9; then
		exec 8>&-
		_frontend_production_deploy_lock_fail \
			"Claimed frontend production deploy lock belongs to another process; refusing to start $operation."
		return 1
	fi
	exec 8>&-
	_frontend_production_deploy_lock_validate_descriptor_for_owner \
		"$lock_file" 9 "$expected_uid" "$expected_gid"
}

_acquire_frontend_production_deploy_lock_for_owner() {
	local operation="$1"
	local lock_file="$2"
	local expected_uid="$3"
	local expected_gid="$4"
	local flock_binary

	flock_binary="$(command -v flock || true)"
	if [[ -z "$flock_binary" || ! -x "$flock_binary" ]]; then
		_frontend_production_deploy_lock_fail \
			'Frontend production deployment requires flock'
		return 1
	fi
	_frontend_production_deploy_lock_validate_file_for_owner \
		"$lock_file" "$expected_uid" "$expected_gid" || return 1

	if [[ -n "${WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD:-}" ||
		-n "${FRONTEND_PRODUCTION_DEPLOY_LOCK_FD:-}" ]]; then
		if [[ "${WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD:-}" != "$lock_file" ||
			"${FRONTEND_PRODUCTION_DEPLOY_LOCK_FD:-}" != '9' ]]; then
			_frontend_production_deploy_lock_fail \
				'Inherited frontend production deploy lock claim is invalid'
			return 1
		fi
		_frontend_production_deploy_lock_validate_held_for_owner \
			"$operation" "$lock_file" "$expected_uid" "$expected_gid" \
			"$flock_binary" || return 1
		return
	fi

	exec 9<>"$lock_file"
	if ! _frontend_production_deploy_lock_validate_descriptor_for_owner \
		"$lock_file" 9 "$expected_uid" "$expected_gid"; then
		exec 9>&-
		return 1
	fi
	if ! "$flock_binary" --exclusive --nonblock 9; then
		exec 9>&-
		_frontend_production_deploy_lock_fail \
			"Another frontend production deployment holds $lock_file; refusing to start $operation."
		return 1
	fi
	if ! _frontend_production_deploy_lock_validate_held_for_owner \
		"$operation" "$lock_file" "$expected_uid" "$expected_gid" \
		"$flock_binary"; then
		"$flock_binary" --unlock 9 || true
		exec 9>&-
		return 1
	fi

	export WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD="$lock_file"
	export FRONTEND_PRODUCTION_DEPLOY_LOCK_FD=9
}

acquire_frontend_production_deploy_lock() {
	local operation="${1:-frontend production deployment}"
	local lock_file="${APP_ROOT:-/opt/winwidget}/deploy/frontend/.production-deploy.lock"

	if [[ "$EUID" -ne 0 ]]; then
		_frontend_production_deploy_lock_fail \
			'Frontend production deploy lock acquisition requires root'
		return 1
	fi
	_acquire_frontend_production_deploy_lock_for_owner \
		"$operation" "$lock_file" 0 0
}
