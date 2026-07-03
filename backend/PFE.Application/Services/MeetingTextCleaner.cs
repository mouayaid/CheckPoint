using System.Text.RegularExpressions;

namespace PFE.Application.Services;

internal static partial class MeetingTextCleaner
{
    public static string CleanText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var normalized = text
            .Replace("\uFEFF", string.Empty, StringComparison.Ordinal)
            .Replace("\uFFFD", string.Empty, StringComparison.Ordinal)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');

        var lines = normalized
            .Split('\n')
            .Select(line => HorizontalWhitespaceRegex().Replace(line, " ").Trim());

        normalized = string.Join("\n", lines);
        normalized = ExcessBlankLinesRegex().Replace(normalized, "\n\n");
        return normalized.Trim();
    }

    [GeneratedRegex(@"[^\S\r\n]+")]
    private static partial Regex HorizontalWhitespaceRegex();

    [GeneratedRegex(@"\n(?:[ \t]*\n){2,}")]
    private static partial Regex ExcessBlankLinesRegex();
}
