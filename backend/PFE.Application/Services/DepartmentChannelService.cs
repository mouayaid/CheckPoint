using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
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
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        if (user.Role.Name != "Manager")
            throw new ForbiddenException("Only managers can send department messages.");

        var userDepartmentId = RequireDepartmentId(user);

        if (userDepartmentId != dto.DepartmentId)
            throw new ForbiddenException("You can only post in your own department.");

        if (string.IsNullOrWhiteSpace(dto.Content))
            throw new BadRequestException("Message content is required.");

        var departmentExists = await _context.Departments
            .AnyAsync(d => d.Id == dto.DepartmentId);

        if (!departmentExists)
            throw new NotFoundException("Department not found.");

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

        // Mark as read for sender (manager)
        await MarkDepartmentChannelAsReadAsync(userId);
        await NotifyDepartmentRecipientsAsync(
            dto.DepartmentId,
            userId,
            "Nouveau message canal",
            $"{user.FullName}: {message.Content}",
            "ChannelMessage",
            message.Id);

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
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        if (user.Role.Name != "Manager")
            throw new ForbiddenException("Only managers can create polls.");

        var userDepartmentId = RequireDepartmentId(user);

        if (userDepartmentId != dto.DepartmentId)
            throw new ForbiddenException("You can only create polls in your own department.");

        if (string.IsNullOrWhiteSpace(dto.Question))
            throw new BadRequestException("Poll question is required.");

        if (dto.Options == null || dto.Options.Count < 2)
            throw new BadRequestException("Poll must contain at least two options.");

        var departmentExists = await _context.Departments
            .AnyAsync(d => d.Id == dto.DepartmentId);

        if (!departmentExists)
            throw new NotFoundException("Department not found.");

        var cleanedOptions = dto.Options
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim())
            .Distinct()
            .ToList();

        if (cleanedOptions.Count < 2)
            throw new BadRequestException("Poll must contain at least two valid options.");

        if (dto.ExpiresAt.HasValue && dto.ExpiresAt.Value <= DateTime.UtcNow)
            throw new BadRequestException("Poll expiration date must be in the future.");

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

        // Mark as read for sender (manager)
        await MarkDepartmentChannelAsReadAsync(userId);
        await NotifyDepartmentRecipientsAsync(
            dto.DepartmentId,
            userId,
            "Nouveau sondage canal",
            $"{user.FullName}: {message.Content}",
            "ChannelMessage",
            message.Id);

        return await GetMessageByIdAsync(message.Id, userId);
    }

    public async Task<List<DepartmentChannelMessageDto>> GetDepartmentFeedAsync(int userId, int departmentId)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        var userDepartmentId = RequireDepartmentId(user);

        if (userDepartmentId != departmentId)
            throw new ForbiddenException("You can only access your own department feed.");

        var messages = await _context.DepartmentChannelMessages
            .Include(m => m.Sender)
                .ThenInclude(s => s.Role)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Options)
            .Include(m => m.Poll!)
                .ThenInclude(p => p.Votes)
            .Where(m =>
                m.DepartmentId == departmentId &&
                m.Sender.DepartmentId == departmentId &&
                m.Sender.Role.Name == "Manager")
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

    public async Task<List<DepartmentChannelMessageDto>> GetMyDepartmentFeedAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        return await GetDepartmentFeedAsync(userId, RequireDepartmentId(user));
    }

    public async Task<DepartmentPollVotersDto> GetPollVotersAsync(int userId, int pollId)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        if (user.Role.Name != "Manager")
            throw new ForbiddenException("Only managers can view poll voters.");

        var userDepartmentId = RequireDepartmentId(user);

        var poll = await _context.DepartmentPolls
            .Include(p => p.Message)
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
                    .ThenInclude(v => v.User)
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null)
            throw new NotFoundException("Poll not found.");

        if (poll.Message.DepartmentId != userDepartmentId)
            throw new ForbiddenException("You can only view voters for polls from your department.");

        return new DepartmentPollVotersDto
        {
            PollId = poll.Id,
            Options = poll.Options
                .OrderBy(o => o.Id)
                .Select(o => new DepartmentPollOptionVotersDto
                {
                    OptionId = o.Id,
                    OptionText = o.Text,
                    Voters = o.Votes
                        .OrderBy(v => v.User.FullName)
                        .Select(v => new DepartmentPollVoterDto
                        {
                            UserId = v.UserId,
                            UserName = v.User.FullName
                        })
                        .ToList()
                })
                .ToList()
        };
    }

    public async Task MarkDepartmentChannelAsReadAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        var userDepartmentId = RequireDepartmentId(user);

        var readState = await _context.DepartmentChannelReadStates
            .FirstOrDefaultAsync(r => r.UserId == userId && r.DepartmentId == userDepartmentId);

        if (readState == null)
        {
            readState = new DepartmentChannelReadState
            {
                UserId = userId,
                DepartmentId = userDepartmentId,
                LastReadAt = DateTime.UtcNow
            };

            _context.DepartmentChannelReadStates.Add(readState);
        }
        else
        {
            readState.LastReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }
    public async Task<MyDepartmentChannelDto> GetMyDepartmentChannelAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        var userDepartmentId = RequireDepartmentId(user);

        var readState = await _context.DepartmentChannelReadStates
            .FirstOrDefaultAsync(r => r.UserId == userId && r.DepartmentId == userDepartmentId);

        var lastReadAt = readState?.LastReadAt;

        var messages = _context.DepartmentChannelMessages
            .Where(m =>
                m.DepartmentId == userDepartmentId &&
                m.Sender.DepartmentId == userDepartmentId &&
                m.Sender.Role.Name == "Manager");

        var unreadCount = await messages.CountAsync(m =>
            (lastReadAt == null || m.CreatedAt > lastReadAt) && m.SenderId != userId);

        var lastMessage = await messages
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

        return new MyDepartmentChannelDto
        {
            DepartmentId = userDepartmentId,
            DepartmentName = user.Department?.Name ?? string.Empty,
            UnreadCount = unreadCount,
            LastMessagePreview = lastMessage == null
                ? null
                : lastMessage.MessageType == "Poll"
                    ? "New poll"
                    : lastMessage.Content,
            LastActivityAt = lastMessage?.CreatedAt
        };
    }
    public async Task VotePollAsync(int userId, int pollId, VoteDepartmentPollDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        if (user.Role.Name != "Employee")
            throw new ForbiddenException("Only employees can vote.");

        var userDepartmentId = RequireDepartmentId(user);

        var poll = await _context.DepartmentPolls
            .Include(p => p.Message)
                .ThenInclude(m => m.Sender)
                    .ThenInclude(s => s.Role)
            .Include(p => p.Options)
            .Include(p => p.Votes)
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null)
            throw new NotFoundException("Poll not found.");

        if (userDepartmentId != poll.Message.DepartmentId)
            throw new ForbiddenException("You can only vote in polls from your department.");

        if (poll.Message.Sender.DepartmentId != userDepartmentId ||
            poll.Message.Sender.Role.Name != "Manager")
            throw new ForbiddenException("You can only vote in polls from your department manager.");

        if (poll.IsClosed)
            throw new BadRequestException("This poll is closed.");

        if (poll.ExpiresAt.HasValue && poll.ExpiresAt.Value <= DateTime.UtcNow)
            throw new BadRequestException("This poll has expired.");

        var optionExists = poll.Options.Any(o => o.Id == dto.OptionId);
        if (!optionExists)
            throw new BadRequestException("Invalid poll option.");

        var alreadyVoted = poll.Votes.Any(v => v.UserId == userId);
        if (alreadyVoted)
            throw new ConflictException("You have already voted in this poll.");

        if (poll.AllowMultipleChoices)
            throw new BadRequestException("This endpoint currently supports single-choice voting only.");

        var vote = new DepartmentPollVote
        {
            PollId = poll.Id,
            PollOptionId = dto.OptionId,
            UserId = userId,
            VotedAt = DateTime.UtcNow
        };

        _context.DepartmentPollVotes.Add(vote);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("You have already voted in this poll.");
        }
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
            throw new NotFoundException("Message not found.");

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

    private static int RequireDepartmentId(User user)
    {
        if (!user.DepartmentId.HasValue)
            throw new BadRequestException("User is not assigned to a department.");

        return user.DepartmentId.Value;
    }

    private async Task NotifyDepartmentRecipientsAsync(
        int departmentId,
        int senderId,
        string title,
        string message,
        string relatedEntityType,
        int relatedEntityId)
    {
        var recipientIds = await _context.Users
            .Where(u =>
                u.DepartmentId == departmentId &&
                u.Id != senderId &&
                u.Role.Name == "Employee" &&
                u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var recipientId in recipientIds)
        {
            await _notificationService.CreateNotificationAsync(
                recipientId,
                title,
                message,
                "Info",
                relatedEntityType,
                relatedEntityId);
        }
    }
}
