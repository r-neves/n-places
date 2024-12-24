export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === "development") {
        // Imports are done inside the function because not all of them are available when
        // compiling the app initially, causing errors at compile time.
        const { NodeSDK } = await import("@opentelemetry/sdk-node");
        const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
        const { Resource } = await import("@opentelemetry/resources");
        const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
        const { SimpleSpanProcessor } = await import("@opentelemetry/sdk-trace-node");
        
        
        const sdk = new NodeSDK({
            resource: new Resource({
                [ATTR_SERVICE_NAME]: "n-places",
            }),
            spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter(
                {
                    url: "http://localhost:4318/v1/traces",
                }
            )),
        });

        sdk.start();
    }
}
