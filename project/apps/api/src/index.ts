import 'dotenv/config';
import { buildServer } from './server';

async function main() {
  const server = await buildServer();

  try {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    if (isNaN(port)) {
      server.log.error('Invalid PORT environment variable');
      process.exit(1);
    }
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    server.log.info(`Server listening at http://${host}:${port}`);

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        try {
          server.log.info(`Received ${signal}, shutting down gracefully...`);
          await server.close();
          server.log.info('Server shut down successfully.');
          process.exit(0);
        } catch (err) {
          server.log.error({ err }, 'Error during server shutdown.');
          process.exit(1);
        }
      });
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();