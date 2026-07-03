using PFE.Application.Common;

namespace PFE.Application.Abstractions;

public interface IEmailService
{
    Task SendAsync(EmailMessage message);
}