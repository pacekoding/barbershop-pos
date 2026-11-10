#!/usr/bin/env bash
set -euo pipefail

backup_database="${1:-DB}"
backup_directory="${2:-backups/d1}"
backup_timestamp="$(TZ=Asia/Jayapura date +%Y-%m-%d_%H-%M-%S_WIT)"
backup_file="${backup_directory}/barbershop-pos_${backup_timestamp}.sql"

mkdir -p "${backup_directory}"
echo "Mengekspor D1 remote '${backup_database}' ke ${backup_file}"
npx wrangler d1 export "${backup_database}" --remote --output "${backup_file}"
echo "Backup selesai: ${backup_file}"
