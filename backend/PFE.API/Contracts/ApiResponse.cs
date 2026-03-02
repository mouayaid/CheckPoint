namespace PFE.API.Contracts;

public class ApiResponse
{
    public bool Success { get; set; } = false;
    public string Message { get; set; } = "An error occurred.";
    public List<string> Errors { get; set; } = new();
    public object? Data { get; set; } = null;
}
