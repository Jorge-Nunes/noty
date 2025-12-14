-- Índice único parcial para deduplicação de mensagens Traccar por dia
-- Aplique manualmente em produção após validação
CREATE UNIQUE INDEX IF NOT EXISTS ux_msglogs_client_type_day_traccar
ON message_logs (client_id, message_type, (DATE_TRUNC('day', created_at)))
WHERE payment_id IS NULL
  AND message_type IN ('traccar_block','traccar_unblock','traccar_warning');
