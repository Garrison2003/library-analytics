import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import serverless from "serverless-http";
import app from "./index.js";

let secretsLoaded = false;

async function loadSecrets(): Promise<void> {
  if (secretsLoaded) return;
  const arn = process.env.ANTHROPIC_API_KEY_SECRET_ARN;
  if (arn) {
    const smClient = new SecretsManagerClient({});
    const { SecretString } = await smClient.send(new GetSecretValueCommand({ SecretId: arn }));
    if (SecretString) {
      process.env.ANTHROPIC_API_KEY = (JSON.parse(SecretString) as { api_key: string }).api_key;
    }
  }
  secretsLoaded = true;
}

const serverlessApp = serverless(app);

export const handler = async (event: unknown, context: unknown): Promise<unknown> => {
  await loadSecrets();
  return serverlessApp(event as Parameters<typeof serverlessApp>[0], context as Parameters<typeof serverlessApp>[1]);
};
