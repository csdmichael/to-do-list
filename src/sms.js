import { createHash, createHmac } from 'node:crypto';

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

export function validatePhoneNumber(phoneNumber) {
  return typeof phoneNumber === 'string' && E164_PHONE_NUMBER.test(phoneNumber.trim());
}

export function formatReminderMessage(todos) {
  const lines = todos.map((todo, index) => `${index + 1}. ${todo.task}`);
  return `Your to-do list:\n${lines.join('\n')}`;
}

export function createSmsClient(env = process.env) {
  const provider = (env.SMS_PROVIDER || 'dry-run').toLowerCase();
  if (provider === 'azure') {
    return new AzureSmsClient(env);
  }
  return new DryRunSmsClient();
}

export class DryRunSmsClient {
  async send({ to, message }) {
    return {
      provider: 'dry-run',
      messageId: `dry-run:${Date.now()}`,
      to,
      characterCount: message.length
    };
  }
}

class AzureSmsClient {
  constructor(env) {
    this.endpoint = required(env.ACS_ENDPOINT, 'ACS_ENDPOINT');
    this.accessKey = required(env.ACS_ACCESS_KEY, 'ACS_ACCESS_KEY');
    this.from = required(env.ACS_FROM_NUMBER, 'ACS_FROM_NUMBER');
  }

  async send({ to, message }) {
    const url = new URL('/sms', this.endpoint);
    url.searchParams.set('api-version', '2021-03-07');

    const body = JSON.stringify({
      from: this.from,
      to: [to],
      message
    });

    const xmsDate = new Date().toUTCString();
    const contentHash = createHash('sha256').update(body).digest('base64');
    const host = url.host;
    const signedHeaderValues = [xmsDate, host, contentHash].join(';');
    const stringToSign = ['POST', `${url.pathname}${url.search}`, signedHeaderValues].join('\n');
    const signature = createHmac('sha256', Buffer.from(this.accessKey, 'base64'))
      .update(stringToSign)
      .digest('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
        'Content-Type': 'application/json',
        'x-ms-content-sha256': contentHash,
        'x-ms-date': xmsDate
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Azure Communication Services SMS request failed with status ${response.status}.`);
    }

    return {
      provider: 'azure',
      status: response.status,
      to,
      characterCount: message.length
    };
  }
}

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required when SMS_PROVIDER=azure.`);
  }
  return value;
}
