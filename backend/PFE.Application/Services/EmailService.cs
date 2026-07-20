using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using PFE.Application.Abstractions;
using PFE.Application.Common;

namespace PFE.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendAsync(EmailMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);

        if (string.IsNullOrWhiteSpace(message.To))
        {
            throw new ArgumentException(
                "Recipient email address is required.",
                nameof(message)
            );
        }

        if (string.IsNullOrWhiteSpace(message.Subject))
        {
            throw new ArgumentException(
                "Email subject is required.",
                nameof(message)
            );
        }

        var smtpHost = _configuration["Email:SmtpHost"];
        var smtpPortValue = _configuration["Email:SmtpPort"];
        var username = _configuration["Email:Username"];
        var password = _configuration["Email:Password"];
        var from = _configuration["Email:From"];

        if (string.IsNullOrWhiteSpace(smtpHost))
        {
            throw new InvalidOperationException(
                "Missing email configuration: Email:SmtpHost."
            );
        }

        if (!int.TryParse(smtpPortValue, out var smtpPort))
        {
            smtpPort = 587;
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            throw new InvalidOperationException(
                "Missing email configuration: Email:Username."
            );
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Missing email configuration: Email:Password."
            );
        }

        if (string.IsNullOrWhiteSpace(from))
        {
            throw new InvalidOperationException(
                "Missing email configuration: Email:From."
            );
        }

        using var client = new SmtpClient(smtpHost, smtpPort)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = true
        };

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(from),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = true
        };

        mailMessage.To.Add(new MailAddress(message.To));

        await client.SendMailAsync(mailMessage);
    }
}