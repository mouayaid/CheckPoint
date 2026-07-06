using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Admin;
using PFE.Application.Services;
using System.Globalization;
using System.Text;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/statistics")]
[Authorize(Roles = "Admin")]
public class AdminStatisticsController : ControllerBase
{
    private readonly IAdminStatisticsService _statisticsService;

    public AdminStatisticsController(IAdminStatisticsService statisticsService)
    {
        _statisticsService = statisticsService;
    }

    /// <summary>
    /// Aggregated statistics for admin dashboards. Optional department filters user-linked metrics.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<AdminStatisticsDto>>> GetStatistics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId)
    {
        var dto = await _statisticsService.GetStatisticsAsync(from, to, departmentId);
        return Ok(ApiResponse<AdminStatisticsDto>.SuccessResponse(dto));
    }

    [HttpPost("chat")]
    public async Task<ActionResult<AdminStatisticsChatResponseDto>> Chat(
        [FromBody] AdminStatisticsChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "A message is required." });

        var stats = await _statisticsService.GetStatisticsAsync(
            request.From,
            request.To,
            request.DepartmentId);
        var question = NormalizeQuestion(request.Message);
        var answer = BuildAnswer(question, stats);

        return Ok(new AdminStatisticsChatResponseDto { Answer = answer });
    }

    private static string BuildAnswer(string question, AdminStatisticsDto stats)
    {
        if (ContainsAny(question, "compte en attente", "comptes en attente", "pending account"))
            return $"Il y a {stats.Users.PendingApproval} compte(s) en attente.";
        if (ContainsAny(question, "utilisateur actif", "utilisateurs actifs", "active user"))
            return $"Il y a {stats.Users.Active} utilisateur(s) actif(s).";
        if (ContainsAny(question, "departement", "department"))
            return $"Il y a {stats.Infrastructure.Departments} département(s).";
        if (ContainsAny(question, "reservation de salle", "reservations de salles", "room reservation"))
            return $"Il y a {stats.RoomReservationsOverlappingPeriod} réservation(s) de salle sur la période.";
        if (ContainsAny(question, "reservation de siege", "reservations de sieges", "seat reservation"))
            return $"Il y a {stats.SeatReservationsInPeriod} réservation(s) de siège sur la période.";
        if (ContainsAny(question, "demande generale", "demandes generales", "general request"))
            return $"Il y a {stats.GeneralRequestsCreatedInPeriod} demande(s) générale(s) sur la période.";
        if (ContainsAny(question, "conge", "conges", "leave request"))
            return $"Il y a {stats.LeaveRequestsOverlappingPeriod} demande(s) de congé sur la période.";
        if (ContainsAny(question, "participant", "participants"))
            return $"Il y a {stats.EventParticipantsForEventsInPeriod} participant(s) aux événements sur la période.";
        if (ContainsAny(question, "annonce", "annonces", "announcement"))
            return $"Il y a {stats.AnnouncementsCreatedInPeriod} annonce(s) publiée(s) sur la période.";
        if (ContainsAny(question, "evenement", "evenements", "event"))
            return $"Il y a {stats.EventsStartingInPeriod} événement(s) sur la période.";
        if (ContainsAny(question, "salle", "salles", "room"))
            return $"Il y a {stats.Infrastructure.Rooms} salle(s).";
        if (ContainsAny(question, "table", "tables"))
            return $"Il y a {stats.Infrastructure.OfficeTables} table(s).";
        if (ContainsAny(question, "siege", "sieges", "poste", "postes", "seat"))
            return $"Il y a {stats.Infrastructure.Seats} siège(s).";
        if (ContainsAny(question, "utilisateur", "utilisateurs", "user"))
            return $"Il y a {stats.Users.Total} utilisateur(s).";

        return "Je peux répondre aux questions sur les utilisateurs, départements, salles, tables, sièges, demandes, réservations, événements et annonces.";
    }

    private static bool ContainsAny(string value, params string[] terms) =>
        terms.Any(value.Contains);

    private static string NormalizeQuestion(string value)
    {
        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                builder.Append(character);
        }
        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
