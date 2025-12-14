-- =========================================================
-- Investigação de duplicidade de mensagens - Noty
-- Somente leitura. Pode rodar com: psql -f investigate_duplicates.sql
-- =========================================================

\echo Connecting to database: noty_production
\connect noty_production

\set ON_ERROR_STOP on
\pset pager off
\timing on
\x auto

-- Use variáveis psql para janelas de análise (como literais SQL seguros)
\set lookback_7d '7 days'
\set lookback_2d '2 days'

-- =========================================================
-- A) Duplicadas por pagamento/tipo no mesmo dia (últimos 7 dias)
-- =========================================================
\echo
\echo ===== A) Duplicadas por pagamento/tipo no mesmo dia (últimos 7 dias) =====
WITH src AS (
  SELECT
    DATE_TRUNC('day', ml.created_at) AS dia,
    ml.payment_id,
    ml.message_type,
    COUNT(*) AS qty,
    ARRAY_AGG(ml.id ORDER BY ml.created_at) AS message_log_ids
  FROM message_logs ml
  WHERE ml.created_at >= NOW() - INTERVAL :'lookback_7d'
    AND ml.payment_id IS NOT NULL
  GROUP BY 1, 2, 3
)
SELECT *
FROM src
WHERE qty > 1
ORDER BY dia DESC, qty DESC;

-- =========================================================
-- B) Duplicadas “quase simultâneas” (<= 5 minutos) por payment_id e message_type
-- =========================================================
\echo
\echo ===== B) Duplicadas “quase simultâneas” (<= 5 minutos) por pagamento/tipo (últimos 7 dias) =====
WITH ml AS (
  SELECT id, client_id, payment_id, message_type, created_at
  FROM message_logs
  WHERE created_at >= NOW() - INTERVAL :'lookback_7d'
    AND payment_id IS NOT NULL
)
SELECT
  a.payment_id,
  a.message_type,
  a.created_at AS created_at_a,
  b.created_at AS created_at_b,
  EXTRACT(EPOCH FROM (b.created_at - a.created_at)) AS seconds_diff,
  a.id AS id_a, b.id AS id_b
FROM ml a
JOIN ml b
  ON a.payment_id = b.payment_id
 AND a.message_type = b.message_type
 AND a.id <> b.id
 AND b.created_at BETWEEN a.created_at AND a.created_at + INTERVAL '5 minutes'
ORDER BY a.payment_id, a.created_at
LIMIT 500;

-- =========================================================
-- C) Amostra de duplicadas (hoje) com dados do cliente
-- =========================================================
\echo
\echo ===== C) Amostra de duplicadas HOJE com dados do cliente =====
SELECT
  ml.created_at,
  c.name AS client_name,
  ml.phone_number,
  ml.payment_id,
  ml.message_type,
  ml.id
FROM message_logs ml
JOIN clients c ON c.id = ml.client_id
WHERE ml.created_at::date = CURRENT_DATE
  AND (ml.payment_id, ml.message_type) IN (
    SELECT payment_id, message_type
    FROM message_logs
    WHERE created_at::date = CURRENT_DATE
    GROUP BY payment_id, message_type
    HAVING COUNT(*) > 1
  )
ORDER BY ml.payment_id, ml.created_at
LIMIT 500;

-- =========================================================
-- D) Duplicadas Traccar (sem payment_id) por cliente/tipo (últimos 7 dias)
-- =========================================================
\echo
\echo ===== D) Duplicadas Traccar por cliente/tipo (últimos 7 dias) =====
WITH src AS (
  SELECT
    DATE_TRUNC('day', ml.created_at) AS dia,
    ml.client_id,
    ml.message_type,
    COUNT(*) AS qty,
    ARRAY_AGG(ml.id ORDER BY ml.created_at) AS message_log_ids
  FROM message_logs ml
  WHERE ml.created_at >= NOW() - INTERVAL :'lookback_7d'
    AND ml.payment_id IS NULL
    AND ml.message_type IN ('traccar_block', 'traccar_unblock', 'traccar_warning')
  GROUP BY 1, 2, 3
)
SELECT *
FROM src
WHERE qty > 1
ORDER BY dia DESC, qty DESC;

-- =========================================================
-- E) Execuções “manual_sync” (últimos 2 dias)
-- =========================================================
\echo
\echo ===== E) Execuções manual_sync (últimos 2 dias) =====
SELECT
  id,
  automation_type,
  status,
  started_at,
  completed_at
FROM automation_logs
WHERE automation_type = 'manual_sync'
  AND started_at >= NOW() - INTERVAL :'lookback_2d'
ORDER BY started_at DESC
LIMIT 200;

-- =========================================================
-- F) Execuções por tipo (últimos 7 dias)
-- =========================================================
\echo
\echo ===== F) Execuções por tipo (warning_pending, overdue_notification, manual_sync) por dia (últimos 7 dias) =====
SELECT
  DATE_TRUNC('day', started_at) AS dia,
  automation_type,
  COUNT(*) AS runs
FROM automation_logs
WHERE automation_type IN ('warning_pending', 'overdue_notification', 'manual_sync')
  AND started_at >= NOW() - INTERVAL :'lookback_7d'
GROUP BY 1, 2
ORDER BY dia DESC, automation_type;

-- =========================================================
-- G) Volume de mensagens por tipo por hora (últimos 2 dias)
-- =========================================================
\echo
\echo ===== G) Volume de mensagens por tipo por hora (últimos 2 dias) =====
SELECT
  DATE_TRUNC('hour', created_at) AS hora,
  message_type,
  COUNT(*) AS qty
FROM message_logs
WHERE created_at >= NOW() - INTERVAL :'lookback_2d'
GROUP BY 1, 2
ORDER BY hora DESC, message_type;

-- =========================================================
-- H) Amostras por janelas típicas (ajuste se necessário)
-- =========================================================
\echo
\echo ===== H1) Amostra 08:55–09:10 (warning/due_today) =====
SELECT
  created_at,
  client_id,
  payment_id,
  message_type,
  id
FROM message_logs
WHERE TO_CHAR(created_at, 'HH24:MI') BETWEEN '08:55' AND '09:10'
  AND created_at::date >= CURRENT_DATE - 7
ORDER BY created_at DESC
LIMIT 500;

\echo
\echo ===== H2) Amostra 10:55–11:10 (overdue) =====
SELECT
  created_at,
  client_id,
  payment_id,
  message_type,
  id
FROM message_logs
WHERE TO_CHAR(created_at, 'HH24:MI') BETWEEN '10:55' AND '11:10'
  AND created_at::date >= CURRENT_DATE - 7
ORDER BY created_at DESC
LIMIT 500;

\echo
\echo ===== H3) Amostra 23:55–00:10 (sincronizações) =====
SELECT
  created_at,
  client_id,
  payment_id,
  message_type,
  id
FROM message_logs
WHERE (
    TO_CHAR(created_at, 'HH24:MI') BETWEEN '23:55' AND '23:59'
    OR TO_CHAR(created_at, 'HH24:MI') BETWEEN '00:00' AND '00:10'
  )
  AND created_at::date >= CURRENT_DATE - 7
ORDER BY created_at DESC
LIMIT 500;
