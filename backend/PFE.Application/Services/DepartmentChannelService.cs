using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.ChannelMessage;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class DepartmentChannelService : IDepartmentChannelService
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public DepartmentChannelService(
        IApplicationDbContext context,
        INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<DepartmentChannelMessageDto> CreateMessageAsync(int userId, CreateDepartmentMessageDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        if (user.Role != Role.Manager)
            throw new Exception("Only managers can send department messages.");

        if (user.DepartmentId != dto.DepartmentId)
            throw new Exception("You can only post in your own department.");

        if (string.IsNullOrWhiteSpace(dto.Content))
            throw new Exception("Message content is required.");

        var departmentExists = await _context.Departments
            .AnyAsync(d => d.Id == dto.DepartmentId);

        if (!departmentExists)
            throw new Exception("Department not found.");

        var message = new DepartmentChannelMessage
        {
            DepartmentId = dto.DepartmentId,
            SenderId = userId,
            Content = dto.Content.Trim(),
            MessageType = "Text",
            IsPinned = dto.IsPinned,
            CreatedAt = DateTime.UtcNow
        };

        _context.DepartmentChannelMessages.Add(message);
        await _context.SaveChangesAsync();

        var employees = await _context.Users
            .Where(u => u.DepartmentId == dto.DepartmentId && u.Role == Role.Employee)
            .ToListAsync();

        foreach (var employee in employees)
        {
            await _notificationService.CreateNotificationAsync(
                employee.Id,
                "New manager message",
                "Your manager posted a new message.",
                "DepartmentMessage",
                "DepartmentChannelMessage",
                message.Id
            );
        }

        return new DepartmentChannelMessageDto
        {
            Id = message.Id,
            DepartmentId = message.DepartmentId,
            SenderId = message.SenderId,
            SenderName = user.FullName,
            Content = message.Content,
            MessageType = message.MessageType,
            IsPinned = message.IsPinned,
            CreatedAt = message.CreatedAt,
            Poll = null
        };
    }

    public async Task<DepartmentChannelMessageDto> CreatePollAsync(int userId, CreateDepartmentPollDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        if (user.Role != Role.Manager)
            throw new Exception("Only managers can create polls.");

        if (user.DepartmentId != dto.DepartmentId)
            throw new Exception("You can only create polls in your own department.");

        if (string.IsNullOrWhiteSpace(dto.Question))
            throw new Exception("Poll question is required.");

        if (dto.Options == null || dto.Options.Count < 2)
            throw new Exception("Poll must contain at least two options.");

        var departmentExists = await _context.Departments
            .AnyAsync(d => d.Id == dto.DepartmentId);

        if (!departmentExists)
            throw new Exception("Department not found.");

        var cleanedOptions = dto.Options
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim())
            .Distinct()
            .ToList();

        if (cleanedOptions.Count < 2)
            throw new Exception("Poll must contain at least two valid options.");

        if (dto.ExpiresAt.HasValue && dto.ExpiresAt.Value <= DateTime.UtcNow)
            throw new Exception("Poll expiration date must be in the future.");

        var message = new DepartmentChannelMessage
        {
            DepartmentId = dto.DepartmentId,
            SenderId = userId,
            Content = dto.Question.Trim(),
            MessageType = "Poll",
            IsPinned = dto.IsPinned,
            CreatedAt = DateTime.UtcNow
        };

        _context.DepartmentChannelMessages.Add(message);
        await _context.SaveChangesAsync();

        var poll = new DepartmentPoll
        {
            MessageId = message.Id,
            Question = dto.Question.Trim(),
            AllowMultipleChoices = dto.AllowMultipleChoices,
            IsClosed = false,
            ExpiresAt = dto.ExpiresAt,
            CreatedAt = DateTime.UtcNow,
            Options = cleanedOptions.Select(option => new DepartmentPollOption
            {
                Text = option
            }).ToList()
        };

        _context.DepartmentPolls.Add(poll);
        await _context.SaveChangesAsync();

        var employees = await _context.Users
            .Where(u => u.DepartmentId == dto.DepartmentId && u.Role == Role.Employee)
            .ToListAsync();

        foreach (var employee in employees)
        {
            await _notificationService.CreateNotificationAsync(
                employee.Id,
                "New poll",
                "Your manager created a new poll.",
                "DepartmentPoll",
                "DepartmentPoll",
                poll.Id
            );
        }

        return await GetMessageByIdAsync(message.Id, userId);
    }

    public async Task<List<DepartmentChannelMessageDto>> GetDepartmentFeedAsync(int userId, int departmentId)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        if (user.DepartmentId != departmentId)
            throw new Exception("You can only access your own department feed.");

        var messages = await _context.DepartmentChannelMessages
            .Include(m => m.Sender)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Options)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Votes)
            .Where(m => m.DepartmentId == departmentId)
            .OrderByDescending(m => m.IsPinned)
            .ThenByDescending(m => m.CreatedAt)
            .ToListAsync();

        var result = messages.Select(message =>
        {
            DepartmentPollDto? pollDto = null;

            if (message.Poll != null)
            {
                var userVote = message.Poll.Votes.FirstOrDefault(v => v.UserId == userId);

                pollDto = new DepartmentPollDto
                {
                    Id = message.Poll.Id,
                    Question = message.Poll.Question,
                    AllowMultipleChoices = message.Poll.AllowMultipleChoices,
                    IsClosed = message.Poll.IsClosed,
                    ExpiresAt = message.Poll.ExpiresAt,
                    HasVoted = userVote != null,
                    SelectedOptionId = userVote?.PollOptionId,
                    Options = message.Poll.Options.Select(o => new DepartmentPollOptionDto
                    {
                        Id = o.Id,
                        Text = o.Text,
                        VoteCount = message.Poll.Votes.Count(v => v.PollOptionId == o.Id)
                    }).ToList()
                };
            }

            return new DepartmentChannelMessageDto
            {
                Id = message.Id,
                DepartmentId = message.DepartmentId,
                SenderId = message.SenderId,
                SenderName = message.Sender.FullName,
                Content = message.Content,
                MessageType = message.MessageType,
                IsPinned = message.IsPinned,
                CreatedAt = message.CreatedAt,
                Poll = pollDto
            };
        }).ToList();

        return result;
    }

    public async Task VotePollAsync(int userId, int pollId, VoteDepartmentPollDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        if (user.Role != Role.Employee)
            throw new Exception("Only employees can vote.");

        var poll = await _context.DepartmentPolls
            .Include(p => p.Message)
            .Include(p => p.Options)
            .Include(p => p.Votes)
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null)
            throw new Exception("Poll not found.");

        if (user.DepartmentId != poll.Message.DepartmentId)
            throw new Exception("You can only vote in polls from your department.");

        if (poll.IsClosed)
            throw new Exception("This poll is closed.");

        if (poll.ExpiresAt.HasValue && poll.ExpiresAt.Value <= DateTime.UtcNow)
            throw new Exception("This poll has expired.");

        var optionExists = poll.Options.Any(o => o.Id == dto.OptionId);
        if (!optionExists)
            throw new Exception("Invalid poll option.");

        var alreadyVoted = poll.Votes.Any(v => v.UserId == userId);
        if (alreadyVoted)
            throw new Exception("You have already voted in this poll.");

        if (poll.AllowMultipleChoices)
            throw new Exception("This endpoint currently supports single-choice voting only.");

        var vote = new DepartmentPollVote
        {
            PollId = poll.Id,
            PollOptionId = dto.OptionId,
            UserId = userId,
            VotedAt = DateTime.UtcNow
        };

        _context.DepartmentPollVotes.Add(vote);
        await _context.SaveChangesAsync();
    }

    private async Task<DepartmentChannelMessageDto> GetMessageByIdAsync(int messageId, int userId)
    {
        var message = await _context.DepartmentChannelMessages
            .Include(m => m.Sender)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Options)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Votes)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
            throw new Exception("Message not found.");

        DepartmentPollDto? pollDto = null;

        if (message.Poll != null)
        {
            var userVote = message.Poll.Votes.FirstOrDefault(v => v.UserId == userId);

            pollDto = new DepartmentPollDto
            {
                Id = message.Poll.Id,
                Question = message.Poll.Question,
                AllowMultipleChoices = message.Poll.AllowMultipleChoices,
                IsClosed = message.Poll.IsClosed,
                ExpiresAt = message.Poll.ExpiresAt,
                HasVoted = userVote != null,
                SelectedOptionId = userVote?.PollOptionId,
                Options = message.Poll.Options.Select(o => new DepartmentPollOptionDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    VoteCount = message.Poll.Votes.Count(v => v.PollOptionId == o.Id)
                }).ToList()
            };
        }

        return new DepartmentChannelMessageDto
        {
            Id = message.Id,
            DepartmentId = message.DepartmentId,
            SenderId = message.SenderId,
            SenderName = message.Sender.FullName,
            Content = message.Content,
            MessageType = message.MessageType,
            IsPinned = message.IsPinned,
            CreatedAt = message.CreatedAt,
            Poll = pollDto
        };
    }
}   