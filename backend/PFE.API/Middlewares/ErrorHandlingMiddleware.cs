using System.Net;
using System.Text.Json;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;

namespace PFE.API.Middlewares;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;
    private readonly IWebHostEnvironment _environment;

    public ErrorHandlingMiddleware(
        RequestDelegate next,
        ILogger<ErrorHandlingMiddleware> logger,
        IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
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
            await HandleExceptionAsync(context, ex, _environment);
        }
    }

    private static Task HandleExceptionAsync(
        HttpContext context,
        Exception exception,
        IWebHostEnvironment environment)
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
        environment.IsDevelopment()
            ? exception.Message
            : "An unexpected error occurred.",
        environment.IsDevelopment()
            ? new List<string> { exception.ToString() }
            : new List<string>())
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
