import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import config from '../config';
import logger from '../config/logger';

/**
 * Initialize Brevo API client
 */
const initBrevoClient = () => {
  if (!config.email.brevoApiKey) {
    logger.warn('Brevo API key not configured. Will attempt to use SMTP fallback.');
    return null;
  }

  try {
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, config.email.brevoApiKey);
    logger.info('Brevo API client initialized successfully');
    return apiInstance;
  } catch (error) {
    logger.error('Failed to initialize Brevo API client', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
};

const brevoClient = initBrevoClient();

/**
 * Create email transporter
 */
const createTransporter = () => {
  const {
    host, port, user, password, secure,
  } = config.email;

  logger.info('Email configuration loaded', {
    host,
    port,
    user,
    secure,
    hasPassword: !!password,
    passwordLength: password?.length || 0,
  });

  if (!user || !password) {
    logger.warn('Email credentials not configured. Email service will not be available.');
    return null;
  }

  logger.info('Creating email transporter with config', {
    host,
    port,
    secure,
    user,
  });

  const transportConfig = {
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
    // Add connection timeout and logging
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: true,
    debug: true,
  };

  logger.info('Transporter config prepared', transportConfig);

  try {
    const transport = nodemailer.createTransport(transportConfig);
    logger.info('Email transporter created successfully');
    return transport;
  } catch (error) {
    logger.error('Failed to create email transporter', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

const transporter = createTransporter();

/**
 * Send verification email
 * @param email - Recipient email
 * @param verificationToken - Email verification token
 * @param userName - User's name or email
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  userName?: string,
): Promise<void> {
  logger.info('Attempting to send verification email', { email, userName, hasBrevoClient: !!brevoClient, hasTransporter: !!transporter });

  const verificationUrl = `${config.app.backendUrl}/api/v1/auth/verify-email?token=${verificationToken}`;
  logger.info('Verification URL generated', { url: verificationUrl });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #25D366; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to WhatsApp Bulk SaaS!</h1>
        </div>
        <div class="content">
          <h2>Hello ${userName || 'there'}!</h2>
          <p>Thank you for registering with WhatsApp Bulk SaaS. To complete your registration and start using our service, please verify your email address.</p>
          <p><a href="${verificationUrl}" class="button">Verify Email Address</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p><strong>Note:</strong> This link will expire in 24 hours.</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} WhatsApp Bulk SaaS. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Try Brevo API first (works on Railway)
  if (brevoClient) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { email: config.email.from, name: 'WhatsApp Bulk SaaS' };
      sendSmtpEmail.to = [{ email, name: userName || email }];
      sendSmtpEmail.subject = 'Verify Your Email - WhatsApp Bulk SaaS';
      sendSmtpEmail.htmlContent = htmlContent;

      logger.info('Sending email via Brevo API...', { to: email, from: config.email.from });
      const result = await brevoClient.sendTransacEmail(sendSmtpEmail);
      logger.info('Verification email sent successfully via Brevo API', {
        email,
        messageId: result.response.body.messageId,
      });
      return;
    } catch (error) {
      logger.error('Failed to send email via Brevo API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        email,
      });
      // Fall through to SMTP if API fails
    }
  }

  // Fallback to SMTP (for local development)
  if (!transporter) {
    logger.warn('No email service configured. Skipping verification email.', { email });
    return;
  }

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: 'Verify Your Email - WhatsApp Bulk SaaS',
    html: htmlContent,
  };

  logger.info('Mail options prepared for SMTP', { from: mailOptions.from, to: mailOptions.to, subject: mailOptions.subject });

  try {
    logger.info('Sending verification email via SMTP...', { to: email, from: config.email.from });
    const info = await transporter.sendMail(mailOptions);
    logger.info('Verification email sent successfully via SMTP', {
      email,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    logger.error('Failed to send verification email via SMTP', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: (error as any)?.code,
      errorCommand: (error as any)?.command,
      stack: error instanceof Error ? error.stack : undefined,
      email,
      emailConfig: {
        host: config.email.host,
        port: config.email.port,
        user: config.email.user,
        secure: config.email.secure,
      },
    });
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send password reset email
 * @param email - Recipient email
 * @param resetToken - Password reset token
 * @param userName - User's name or email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string,
): Promise<void> {
  if (!transporter) {
    logger.warn('Email service not configured. Skipping password reset email.');
    return;
  }

  const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: 'Reset Your Password - WhatsApp Bulk SaaS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #25D366; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'there'}!</h2>
            <p>We received a request to reset your password for your WhatsApp Bulk SaaS account.</p>
            <p><a href="${resetUrl}" class="button">Reset Password</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <div class="warning">
              <strong>Important:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This link will expire in 1 hour.</li>
                <li>If you didn't request a password reset, please ignore this email.</li>
                <li>Your password will not be changed until you access the link above and create a new one.</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WhatsApp Bulk SaaS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error('Failed to send password reset email', { error, email });
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send account locked notification email
 * @param email - Recipient email
 * @param userName - User's name or email
 * @param lockDuration - Duration of the lock in minutes
 */
export async function sendAccountLockedEmail(
  email: string,
  userName?: string,
  lockDuration: number = 30,
): Promise<void> {
  if (!transporter) {
    logger.warn('Email service not configured. Skipping account locked email.');
    return;
  }

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: 'Account Temporarily Locked - WhatsApp Bulk SaaS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .alert { background-color: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Account Temporarily Locked</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'there'}!</h2>
            <div class="alert">
              <strong>Security Alert:</strong> Your account has been temporarily locked due to multiple failed login attempts.
            </div>
            <p>For your security, we've locked your account for <strong>${lockDuration} minutes</strong>.</p>
            <p>After this time, you'll be able to log in again. If you believe this was unauthorized activity, please reset your password immediately.</p>
            <p>If you didn't attempt to log in, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WhatsApp Bulk SaaS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Account locked notification sent to ${email}`);
  } catch (error) {
    logger.error('Failed to send account locked email', { error, email });
    // Don't throw error for notification emails
  }
}
