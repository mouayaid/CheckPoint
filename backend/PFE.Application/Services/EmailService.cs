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
        var smtpHost = _configuration["Email:SmtpHost"];
        var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
        var username = _configuration["Email:Username"];
        var password = _configuration["Email:Password"];
        var from = _configuration["Email:From"];

        using var client = new SmtpClient(smtpHost, smtpPort)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = true
        };

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(from!),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = true
        };

        mailMessage.To.Add(message.To);

        await client.SendMailAsync(mailMessage);
    }
}