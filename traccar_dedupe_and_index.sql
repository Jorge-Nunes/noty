-- =========================================================
-- Deduplicação e Índice Único (Traccar) - Noty
-- Este script:
-- 1) Remove duplicatas por (client_id, message_type, dia_UTC) mantendo o primeiro registro
-- 2) Cria índice único parcial IMUTÁVEL para prevenir novas duplicatas
-- Somente afeta mensagens Traccar (sem payment_id):
--   message_type IN ('traccar_block','traccar_unblock','traccar_warning')
-- =========================================================

\set ON_ERROR_STOP on
\pset pager off
\timing on
\x auto

\echo
\echo ===== Passo 1: Verificando duplicatas atuais (dia UTC) =====
WITH cte AS (
  SELECT
    client_id,
    message_type,
    ((created_at AT TIME ZONE 'UTC')::date) AS dia_utc,
    COUNT(*) AS qty,
    ARRAY_AGG(id ORDER BY created_at) AS ids
  FROM message_logs
  WHERE payment_id IS NULL
    AND message_type IN ('traccar_block','traccar_unblock','traccar_warning')
  GROUP BY 1,2,3
)
SELECT * FROM cte WHERE qty > 1
ORDER BY dia_utc DESC, qty DESC;

\echo
\echo ===== Passo 2: Removendo duplicatas (mantendo o primeiro registro por grupo) =====
WITH ranked AS (
  SELECT
    id,
    client_id,
    message_type,
    ((created_at AT TIME ZONE 'UTC')::date) AS dia_utc,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, message_type, ((created_at AT TIME ZONE 'UTC')::date)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM message_logs
  WHERE payment_id IS NULL
    AND message_type IN ('traccar_block','traccar_unblock','traccar_warning')
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM message_logs
WHERE id IN (SELECT id FROM to_delete);

\echo
\echo ===== Passo 3: Criando índice único parcial IMUTÁVEL =====
CREATE UNIQUE INDEX IF NOT EXISTS ux_msglogs_client_type_day_traccar
ON message_logs (
  client_id,
  message_type,
  ((created_at AT TIME ZONE 'UTC')::date)
)
WHERE payment_id IS NULL
  AND message_type IN ('traccar_block','traccar_unblock','traccar_warning');

\echo
\echo ===== Passo 4: Conferindo índice criado =====
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'message_logs'
  AND indexname = 'ux_msglogs_client_type_day_traccar';

\echo
\echo ===== Passo 5: Revalidando duplicatas (deve retornar 0 linhas) =====
WITH cte AS (
  SELECT
    client_id,
    message_type,
    ((created_at AT TIME ZONE 'UTC')::date) AS dia_utc,
    COUNT(*) AS qty
  FROM message_logs
  WHERE payment_id IS NULL
    AND message_type IN ('traccar_block','traccar_unblock','traccar_warning')
  GROUP BY 1,2,3
)
SELECT * FROM cte WHERE qty > 1
ORDER BY dia_utc DESC, qty DESC;
