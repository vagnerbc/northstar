import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import type { EmailProvider } from '../application/ports.js';
import type { EmailContent } from '../domain/notification.js';

export class SmtpEmailProvider implements EmailProvider {
  private readonly transport;
  public constructor(
    host: string,
    port: number,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({ host, port, secure: false });
  }
  public async send(message: EmailContent): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export class SesEmailProvider implements EmailProvider {
  private readonly client: SESv2Client;
  public constructor(
    region: string,
    private readonly from: string,
  ) {
    this.client = new SESv2Client({ region });
  }
  public async send(message: EmailContent): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject },
            Body: { Text: { Data: message.text }, Html: { Data: message.html } },
          },
        },
      }),
    );
  }
}
