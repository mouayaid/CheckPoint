namespace PFE.Application.Common.Exceptions;

/// <summary>
/// A small, frontend-friendly validation exception that controllers can catch
/// and convert into ApiResponse.ErrorResponse(message, errors).
/// </summary>
public class FrontendValidationException : Exception
{
    public int StatusCode { get; }
    public List<string> Errors { get; }

    public FrontendValidationException(int statusCode, string message, IEnumerable<string>? errors = null)
        : base(message)
    {
        StatusCode = statusCode;
        Errors = errors?.ToList() ?? new List<string>();
    }
}

