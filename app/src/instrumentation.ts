import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { registerOTel } from '@vercel/otel';

export function register() {
    console.log('Registering OpenTelemetry');
    if (!process.env.AXIOM_DOMAIN || !process.env.AXIOM_API_TOKEN || !process.env.AXIOM_DATASET_NAME) {
        console.warn('Missing required environment variables to register OpenTelemetry');
        return;
    }

    registerOTel({
        serviceName: 'nextjs-app',
        spanProcessors: [
            new SimpleSpanProcessor(
                new OTLPTraceExporter({
                    url: `https://${process.env.AXIOM_DOMAIN}/v1/traces`,
                    headers: {
                        Authorization: `Bearer ${process.env.AXIOM_API_TOKEN}`,
                        'X-Axiom-Dataset': `${process.env.AXIOM_DATASET_NAME}`,
                    },
                })
            )
        ],
    });
}