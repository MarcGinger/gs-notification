import { Injectable } from '@nestjs/common';
import {
  SecretRefService,
  SecretRef,
  createSecretRef,
  parseSecretUri,
} from '../index';

/**
 * Example: Slack HTTP client using SecretRef adapter
 *
 * This demonstrates how to use the SecretRef adapter in a real service
 * that needs to resolve secrets for external API calls.
 */
@Injectable()
export class SlackHttpClient {
  constructor(private readonly secrets: SecretRefService) {}

  async postMessage(
    cfg: {
      botTokenRef: SecretRef;
      signingSecretRef: SecretRef;
    },
    payload: {
      channel: string;
      text: string;
    },
  ) {
    const ctx = {
      tenantId: cfg.botTokenRef.tenant,
      boundedContext: cfg.botTokenRef.namespace,
      purpose: 'http-sign' as const,
      environment: (process.env.NODE_ENV ?? 'dev') as any,
    };

    // Resolve both secrets concurrently
    const [{ value: botToken }, { value: signingSecret }] = await Promise.all([
      this.secrets.resolve(cfg.botTokenRef, { minTtlMs: 60_000 }, ctx),
      this.secrets.resolve(cfg.signingSecretRef, { minTtlMs: 60_000 }, ctx),
    ]);

    // Use the resolved secrets (never log them!)
    const headers = this.buildSlackHeaders(signingSecret, payload);

    return this.httpPost('https://slack.com/api/chat.postMessage', payload, {
      headers: {
        ...headers,
        Authorization: `Bearer ${botToken}`,
      },
    });
  }

  private buildSlackHeaders(signingSecret: string, payload: any) {
    // Implement HMAC-SHA256 signature for Slack
    // This is just a placeholder implementation
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = `v0=${this.computeHmac(signingSecret, timestamp, payload)}`;

    return {
      'X-Slack-Request-Timestamp': timestamp.toString(),
      'X-Slack-Signature': signature,
    };
  }

  private computeHmac(secret: string, timestamp: number, payload: any): string {
    // Placeholder - implement actual HMAC-SHA256
    return `hmac_${secret.length}_${timestamp}_${JSON.stringify(payload).length}`;
  }

  private async httpPost(url: string, data: any, options: any) {
    // Placeholder HTTP implementation
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
  }
}

/**
 * Example configuration for Slack service
 *
 * Shows how to create SecretRef instances for configuration
 */
export class SlackServiceConfig {
  // Create SecretRef instances for your secrets
  static createSlackConfig(tenant: string, namespace: string) {
    return {
      botTokenRef: createSecretRef(
        'doppler',
        tenant,
        namespace,
        'slack/bot-token',
        'latest',
      ),
      signingSecretRef: createSecretRef(
        'doppler',
        tenant,
        namespace,
        'slack/signing-secret',
        'latest',
      ),
    };
  }

  // Or parse from URI format
  static fromUris(botTokenUri: string, signingSecretUri: string) {
    return {
      botTokenRef: parseSecretUri(botTokenUri),
      signingSecretRef: parseSecretUri(signingSecretUri),
    };
  }
}

// Usage example in a service or aggregate
export class NotificationService {
  constructor(private readonly slackClient: SlackHttpClient) {}

  async sendSlackNotification(message: string) {
    const config = SlackServiceConfig.createSlackConfig('core', 'notification');

    await this.slackClient.postMessage(config, {
      channel: '#notifications',
      text: message,
    });
  }
}
