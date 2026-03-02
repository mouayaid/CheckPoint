using System.Net;
using System.Text.Json;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;

namespace PFE.API.Middlewares;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
            throw exception;

        (HttpStatusCode code, string message, List<string> errors) = exception switch
{
    NotFoundException nf => (HttpStatusCode.NotFound, nf.Message, new List<string>()),
    ConflictException cf => (HttpStatusCode.Conflict, cf.Message, new List<string>()),
    ForbiddenException fb => (HttpStatusCode.Forbidden, fb.Message, new List<string>()),

    BadRequestException br => (HttpStatusCode.BadRequest, br.Message, new List<string>()),

    UnauthorizedAccessException ua => (HttpStatusCode.Unauthorized,
        string.IsNullOrWhiteSpace(ua.Message) ? "Unauthorized." : ua.Message,
        new List<string>()),

    ArgumentException ae => (HttpStatusCode.BadRequest,
        "Invalid request.",
        new List<string> { ae.Message }),

    _ => (HttpStatusCode.InternalServerError,
        "An unexpected error occurred.",
        new List<string>())
};

        var result = JsonSerializer.Serialize(
            ApiResponse<object>.ErrorResponse(message, errors),
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
        );

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)code;

        return context.Response.WriteAsync(result);
    }
}
