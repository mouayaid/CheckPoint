using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Admin;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class AdminChatbotService : IAdminChatbotService
{
    private const string Capabilities =
        "Je peux répondre aux questions sur les utilisateurs, leurs noms et rôles, les départements, les demandes, les réservations de salles, les événements et les annonces.";

    private readonly IApplicationDbContext _db;

    public AdminChatbotService(IApplicationDbContext db) => _db = db;

    public async Task<AdminStatisticsChatResponseDto> AnswerAsync(AdminStatisticsChatRequestDto request)
    {
        var question = Normalize(request.Message);
        var (from, to) = ResolveRange(question, request.From, request.To);
        var departmentId = request.DepartmentId is > 0 ? request.DepartmentId : null;
        var answers = new List<string>();
        var detected = false;

        var mentionsUsers = Has(question, "utilisateur", "user", "compte");
        var asksPending = mentionsUsers && Has(question, "attente", "pending", "non approuve");
        var asksActive = mentionsUsers && Has(question, "actif", "active");
        var asksRole = mentionsUsers && Has(question, "role", "roles");
        var asksFirstNames = mentionsUsers && Has(question, "prenom", "prenoms", "first name");
        var asksFullNames = mentionsUsers && Has(question, "nom complet", "noms complets", "nom des utilisateur", "noms des utilisateur", "full name", "qui sont", "liste", "lister") && !asksRole;
        var asksUserCount = mentionsUsers && Has(question, "combien", "nombre", "total", "count", "how many");

        var users = _db.Users.AsNoTracking();
        if (departmentId.HasValue)
            users = users.Where(u => u.DepartmentId == departmentId.Value);

        if (asksPending)
        {
            detected = true;
            var pending = await users.Where(u => !u.IsActive && u.ApprovedAt == null && u.RejectedAt == null)
                .OrderBy(u => u.FullName).Select(u => u.FullName).ToListAsync();
            answers.Add(pending.Count == 0
                ? "Aucun utilisateur n'est en attente d'approbation."
                : $"Utilisateurs en attente ({pending.Count}) : {Join(pending)}.");
        }
        else if (asksActive)
        {
            detected = true;
            var active = await users.CountAsync(u => u.IsActive && u.RejectedAt == null);
            answers.Add($"Il y a {active} utilisateur(s) actif(s).");
        }
        else
        {
            if (asksUserCount)
            {
                detected = true;
                answers.Add($"Il y a {await users.CountAsync()} utilisateur(s).");
            }

            if (asksRole)
            {
                detected = true;
                var rows = await users.OrderBy(u => u.FullName)
                    .Select(u => new { u.FullName, Role = u.Role.Name }).ToListAsync();
                answers.Add(rows.Count == 0
                    ? "Aucun utilisateur avec un rôle n'a été trouvé."
                    : $"Utilisateurs et rôles : {Join(rows.Select(x => $"{x.FullName} — {x.Role}"))}.");
            }
            else if (asksFirstNames)
            {
                detected = true;
                var names = await users.OrderBy(u => u.FullName).Select(u => u.FullName).ToListAsync();
                // TODO: Use a dedicated FirstName field if one is added to User; currently only FullName exists.
                var firstNames = names.Select(FirstName).Where(x => x.Length > 0).ToList();
                answers.Add(firstNames.Count == 0 ? "Aucun prénom n'est disponible." : $"Prénoms : {Join(firstNames)}.");
            }
            else if (asksFullNames)
            {
                detected = true;
                var names = await users.OrderBy(u => u.FullName).Select(u => u.FullName).ToListAsync();
                answers.Add(names.Count == 0 ? "Aucun nom d'utilisateur n'est disponible." : $"Utilisateurs : {Join(names)}.");
            }
        }

        var mentionsDepartment = Has(question, "departement", "department");
        if (mentionsDepartment && Has(question, "plus d utilisateur", "plus de user", "most user"))
        {
            detected = true;
            var departments = _db.Departments.AsNoTracking();
            if (departmentId.HasValue)
                departments = departments.Where(d => d.Id == departmentId.Value);
            var top = await departments.Select(d => new { d.Name, Count = d.Users.Count })
                .OrderByDescending(x => x.Count).ThenBy(x => x.Name).FirstOrDefaultAsync();
            answers.Add(top == null
                ? "Aucun département n'est disponible pour déterminer celui qui a le plus d'utilisateurs."
                : $"Le département avec le plus d'utilisateurs est {top.Name} ({top.Count} utilisateur(s)).");
        }
        else if (mentionsDepartment && Has(question, "combien", "nombre", "total", "count", "how many"))
        {
            detected = true;
            var count = departmentId.HasValue
                ? await _db.Departments.AsNoTracking().CountAsync(d => d.Id == departmentId.Value)
                : await _db.Departments.AsNoTracking().CountAsync();
            answers.Add($"Il y a {count} département(s).");
        }

        var status = DetectRequestStatus(question);
        var mentionsLeave = Has(question, "conge", "leave");
        var mentionsGeneral = Has(question, "demande generale", "demandes generales", "general request");
        var mentionsRequest = mentionsLeave || mentionsGeneral || Has(question, "demande", "request");
        if (mentionsRequest && (Has(question, "combien", "nombre", "total", "count", "how many") || status.HasValue))
        {
            detected = true;
            if (mentionsLeave)
                answers.Add(await CountLeaveRequests(from, to, departmentId, status));
            else if (mentionsGeneral)
                answers.Add(await CountGeneralRequests(from, to, departmentId, status));
            else
            {
                answers.Add(await CountLeaveRequests(from, to, departmentId, status));
                answers.Add(await CountGeneralRequests(from, to, departmentId, status));
            }
        }

        var mentionsRoomReservation = Has(question, "reservation de salle", "reservations de salle", "salle reservee", "salles reservees", "room reservation", "reserved room");
        if (mentionsRoomReservation && Has(question, "plus reserve", "plus souvent", "most reserved", "top"))
        {
            detected = true;
            var reservations = RoomReservations(from, to, departmentId);
            var rooms = await reservations.GroupBy(r => r.Room.Name)
                .Select(g => new { Name = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count).ThenBy(x => x.Name).Take(5).ToListAsync();
            answers.Add(rooms.Count == 0
                ? "Aucune réservation de salle n'est disponible sur la période sélectionnée."
                : $"Salles les plus réservées : {Join(rooms.Select(x => $"{x.Name} ({x.Count})"))}.");
        }
        else if (mentionsRoomReservation)
        {
            detected = true;
            answers.Add($"Il y a {await RoomReservations(from, to, departmentId).CountAsync()} réservation(s) de salle sur la période.");
        }

        if (Has(question, "evenement", "event") && Has(question, "combien", "nombre", "total", "count", "how many"))
        {
            detected = true;
            var events = _db.Events.AsNoTracking().Where(e => e.StartDateTime >= from && e.StartDateTime <= to);
            if (departmentId.HasValue) events = events.Where(e => e.CreatedByUser.DepartmentId == departmentId.Value);
            answers.Add($"Il y a {await events.CountAsync()} événement(s) sur la période.");
        }

        if (Has(question, "annonce", "announcement") && Has(question, "combien", "nombre", "total", "count", "how many"))
        {
            detected = true;
            var announcements = _db.Announcements.AsNoTracking().Where(a => a.CreatedAt >= from && a.CreatedAt <= to);
            if (departmentId.HasValue) announcements = announcements.Where(a => a.CreatedBy.DepartmentId == departmentId.Value);
            answers.Add($"Il y a {await announcements.CountAsync()} annonce(s) publiée(s) sur la période.");
        }

        return new AdminStatisticsChatResponseDto { Answer = detected ? string.Join(" ", answers) : Capabilities };
    }

    private async Task<string> CountLeaveRequests(DateTime from, DateTime to, int? departmentId, RequestStatus? status)
    {
        var query = _db.LeaveRequests.AsNoTracking().Where(x => x.StartDate <= to && x.EndDate >= from);
        if (departmentId.HasValue) query = query.Where(x => x.User.DepartmentId == departmentId.Value);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        return $"Demandes de congé{StatusLabel(status)} : {await query.CountAsync()}.";
    }

    private async Task<string> CountGeneralRequests(DateTime from, DateTime to, int? departmentId, RequestStatus? status)
    {
        var query = _db.GeneralRequests.AsNoTracking().Where(x => x.CreatedAt >= from && x.CreatedAt <= to);
        if (departmentId.HasValue) query = query.Where(x => x.User.DepartmentId == departmentId.Value);
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        return $"Demandes générales{StatusLabel(status)} : {await query.CountAsync()}.";
    }

    private IQueryable<PFE.Domain.Entities.RoomReservation> RoomReservations(DateTime from, DateTime to, int? departmentId)
    {
        var query = _db.RoomReservations.AsNoTracking().Where(x => x.StartDateTime <= to && x.EndDateTime >= from);
        if (departmentId.HasValue) query = query.Where(x => x.User.DepartmentId == departmentId.Value);
        return query;
    }

    private static RequestStatus? DetectRequestStatus(string value)
    {
        if (Has(value, "refuse", "refusee", "refusees", "rejete", "rejected")) return RequestStatus.Rejected;
        if (Has(value, "approuve", "approuvee", "accepte", "approved")) return RequestStatus.Approved;
        if (Has(value, "en attente", "attente", "pending")) return RequestStatus.Pending;
        if (Has(value, "en cours", "in progress")) return RequestStatus.InProgress;
        if (Has(value, "resolue", "resolu", "resolved")) return RequestStatus.Resolved;
        if (Has(value, "annulee", "annule", "cancelled", "canceled")) return RequestStatus.Cancelled;
        return null;
    }

    private static string StatusLabel(RequestStatus? status) => status switch
    {
        RequestStatus.Pending => " en attente",
        RequestStatus.Approved => " approuvées",
        RequestStatus.Rejected => " refusées",
        RequestStatus.InProgress => " en cours",
        RequestStatus.Resolved => " résolues",
        RequestStatus.Cancelled => " annulées",
        _ => string.Empty
    };

    private static (DateTime From, DateTime To) ResolveRange(string question, DateTime? requestedFrom, DateTime? requestedTo)
    {
        var today = DateTime.UtcNow.Date;
        if (!requestedFrom.HasValue && !requestedTo.HasValue && Has(question, "ce mois", "this month"))
            return (new DateTime(today.Year, today.Month, 1), today.AddDays(1).AddTicks(-1));

        var from = (requestedFrom ?? today.AddDays(-29)).Date;
        var to = (requestedTo ?? today).Date;
        if (from > to) (from, to) = (to, from);
        return (from, to.AddDays(1).AddTicks(-1));
    }

    private static string Normalize(string value)
    {
        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.IsLetterOrDigit(character) ? character : ' ');
        return Regex.Replace(builder.ToString(), @"\s+", " ").Trim();
    }

    private static bool Has(string value, params string[] terms) => terms.Any(value.Contains);
    private static string Join(IEnumerable<string> values) => string.Join(", ", values);
    private static string FirstName(string fullName) =>
        fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
}
