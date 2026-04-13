export interface ServerConfig {
  port: number;
}

export function getServerConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 8080),
  };
}
