import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

const noopLogger = { emit() {} };

function requirePostHogConfig(name) {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`${name} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${name} is configured`);
  }
}

function createLogger() {
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST;
  if (!projectToken) {
    requirePostHogConfig('POSTHOG_PROJECT_TOKEN');
    return noopLogger;
  }
  if (!host) {
    requirePostHogConfig('POSTHOG_HOST');
    return noopLogger;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'typezone-server',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor(new OTLPLogExporter({
        url: `${host.replace(/\/$/, '')}/i/v1/logs`,
        headers: { Authorization: `Bearer ${projectToken}` },
      })),
    ],
  });
  sdk.start();
  return logs.getLogger('typezone-posthog');
}

const posthogLogger = createLogger();

export function logInfo(body, attributes) {
  posthogLogger.emit({ severityText: 'INFO', body, attributes });
}

export function logError(body, attributes) {
  posthogLogger.emit({ severityText: 'ERROR', body, attributes });
}
